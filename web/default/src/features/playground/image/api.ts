/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { isAxiosError } from 'axios'
import { api } from '@/lib/api'
import { bearerConfig } from '../shared/request-config'
import type {
  ImageDataItem,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from './types'

export const IMAGE_GEN_ENDPOINT = '/v1/images/generations'

// Image generation regularly hits 504/502 from upstream gateways even when the
// underlying model is reachable. The backend's retry loop hard-skips 504/524
// (see setting/operation_setting/status_code_ranges.go), so we add a small
// client-side retry here to smooth over transient gateway failures.
const TRANSIENT_STATUS_CODES = new Set([408, 425, 502, 503, 504])
const MAX_RETRIES = 2
const RETRY_BACKOFF_MS = 1500

function isTransientGatewayError(error: unknown): boolean {
  if (!isAxiosError(error)) return false
  const status = error.response?.status
  if (status != null) return TRANSIENT_STATUS_CODES.has(status)
  // No response at all (network error, aborted, timeout) — retry once.
  return error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function generateImage(
  payload: ImageGenerationRequest,
  apiKey: string
): Promise<ImageGenerationResponse> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await api.post(
        IMAGE_GEN_ENDPOINT,
        payload,
        bearerConfig(apiKey)
      )
      return res.data
    } catch (error) {
      lastError = error
      if (attempt >= MAX_RETRIES || !isTransientGatewayError(error)) {
        throw error
      }
      await sleep(RETRY_BACKOFF_MS * (attempt + 1))
    }
  }
  throw lastError
}

export interface ImageStreamCallbacks {
  onPartial?: (b64: string, index: number) => void
  onCompleted?: (image: ImageDataItem) => void
  signal?: AbortSignal
}

interface SSEUsage {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  prompt_tokens?: number
  completion_tokens?: number
}

interface SSEEvent {
  type?: string
  b64_json?: string
  partial_image_index?: number
  revised_prompt?: string
  usage?: SSEUsage
  error?: { message?: string } | string
  message?: string
}

async function readSSEError(response: Response): Promise<string> {
  try {
    const text = await response.text()
    try {
      const parsed = JSON.parse(text) as {
        error?: { message?: string }
        message?: string
      }
      return (
        parsed.error?.message ??
        parsed.message ??
        text ??
        `HTTP ${response.status}`
      )
    } catch {
      return text || `HTTP ${response.status}`
    }
  } catch {
    return `HTTP ${response.status}`
  }
}

/**
 * Stream image generation via SSE. Emits partial images via onPartial while
 * the upstream is still working, and resolves with the final ImageDataItem
 * once the `image_generation.completed` event arrives.
 */
export async function generateImageStream(
  payload: ImageGenerationRequest,
  apiKey: string,
  callbacks: ImageStreamCallbacks = {}
): Promise<ImageDataItem> {
  const body: ImageGenerationRequest = {
    ...payload,
    stream: true,
    // Streaming responses cannot return URLs; force b64_json so the client
    // can render partial frames inline.
    response_format: 'b64_json',
  }

  const response = await fetch(IMAGE_GEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${apiKey}`,
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
    credentials: 'include',
    signal: callbacks.signal,
  })

  if (!response.ok || !response.body) {
    const message = await readSSEError(response)
    throw new Error(message)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let finalImage: ImageDataItem | null = null
  // OpenAI emits `revised_prompt` on different events depending on the
  // model (sometimes the early metadata event, sometimes alongside a
  // partial frame, sometimes on completed). Track the latest value seen
  // across the stream so it is never lost.
  let latestRevisedPrompt: string | undefined

  const handleEvent = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    if (trimmed === '[DONE]') return
    let event: SSEEvent
    try {
      event = JSON.parse(trimmed) as SSEEvent
    } catch {
      return
    }
    if (event.error) {
      const message =
        typeof event.error === 'string'
          ? event.error
          : (event.error.message ?? 'Image stream error')
      throw new Error(message)
    }
    if (event.revised_prompt) {
      latestRevisedPrompt = event.revised_prompt
    }
    const type = event.type ?? ''
    if (type.endsWith('partial_image') && event.b64_json) {
      const idx = event.partial_image_index ?? 0
      callbacks.onPartial?.(event.b64_json, idx)
      return
    }
    if (type.endsWith('completed') && event.b64_json) {
      finalImage = {
        b64_json: event.b64_json,
        revised_prompt: event.revised_prompt ?? latestRevisedPrompt,
      }
      callbacks.onCompleted?.(finalImage)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newlineIdx = buffer.indexOf('\n')
    while (newlineIdx !== -1) {
      const line = buffer.slice(0, newlineIdx)
      buffer = buffer.slice(newlineIdx + 1)
      const stripped = line.replace(/\r$/, '')
      if (stripped.startsWith('data:')) {
        handleEvent(stripped.slice(5).trimStart())
      }
      newlineIdx = buffer.indexOf('\n')
    }
  }

  // Drain anything left in the buffer (e.g. last line without trailing \n).
  const tail = buffer.replace(/\r$/, '')
  if (tail.startsWith('data:')) {
    handleEvent(tail.slice(5).trimStart())
  }

  if (!finalImage) {
    throw new Error('Stream ended without a completed image event')
  }
  return finalImage
}
