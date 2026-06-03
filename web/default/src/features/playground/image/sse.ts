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
import type { ImageDataItem } from './types'

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
  url?: string
  b64_json?: string
  partial_image_index?: number
  revised_prompt?: string
  usage?: SSEUsage
  error?: { message?: string } | string
  message?: string
}

export async function readSSEError(response: Response): Promise<string> {
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
 * Read an image-generation/edit SSE stream. Emits partial frames via onPartial
 * and resolves with the final ImageDataItem when the completed event arrives.
 */
export async function consumeImageStream(
  response: Response,
  callbacks: ImageStreamCallbacks
): Promise<ImageDataItem> {
  if (!response.ok || !response.body) {
    throw new Error(await readSSEError(response))
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let finalImage: ImageDataItem | null = null
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
    if (type.endsWith('completed') && (event.url || event.b64_json)) {
      finalImage = {
        url: event.url,
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

  const tail = buffer.replace(/\r$/, '')
  if (tail.startsWith('data:')) {
    handleEvent(tail.slice(5).trimStart())
  }

  if (!finalImage) {
    throw new Error('Stream ended without a completed image event')
  }
  return finalImage
}
