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
import { buildEditFormData } from './edit-form-data'
import { consumeImageStream, type ImageStreamCallbacks } from './sse'
import type {
  ImageDataItem,
  ImageEditRequest,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from './types'

export type { ImageStreamCallbacks } from './sse'

export const IMAGE_GEN_ENDPOINT = '/v1/images/generations'
export const IMAGE_EDIT_ENDPOINT = '/v1/images/edits'

// Async task endpoints: submit returns a task_id immediately; the actual
// (synchronous) upstream generation runs in a background worker on the server,
// so the user can leave the page / refresh / close the browser and poll later.
export const IMAGE_GEN_TASK_ENDPOINT = '/v1/images/generations/tasks'
export const IMAGE_EDIT_TASK_ENDPOINT = '/v1/images/edits/tasks'

export interface ImageTaskSubmitResponse {
  task_id: string
  status: string
  submit_time?: number
}

export interface ImageTaskFetchResponse {
  task_id: string
  status: string
  progress?: string
  fail_reason?: string
  // Present once the task succeeds — the upstream image response payload.
  data?: ImageGenerationResponse | null
}

/** Submit a text→image generation as a server-side async task. */
export async function submitImageGenerationTask(
  payload: ImageGenerationRequest,
  apiKey: string
): Promise<ImageTaskSubmitResponse> {
  const body: ImageGenerationRequest = { ...payload }
  // Async tasks cannot stream — results are polled.
  delete body.stream
  delete body.partial_images
  const res = await api.post(
    IMAGE_GEN_TASK_ENDPOINT,
    body,
    bearerConfig(apiKey)
  )
  return res.data
}

/** Submit an image→image edit (multipart) as a server-side async task. */
export async function submitImageEditTask(
  req: ImageEditRequest,
  apiKey: string
): Promise<ImageTaskSubmitResponse> {
  const res = await api.post(
    IMAGE_EDIT_TASK_ENDPOINT,
    buildEditFormData({ ...req, stream: false }),
    bearerConfig(apiKey)
  )
  return res.data
}

/** Poll the status/result of a previously submitted image task. */
export async function fetchImageTask(
  taskId: string,
  apiKey: string
): Promise<ImageTaskFetchResponse> {
  const res = await api.get(
    `${IMAGE_GEN_TASK_ENDPOINT}/${encodeURIComponent(taskId)}`,
    bearerConfig(apiKey)
  )
  return res.data
}

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
    response_format: 'url',
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

  return consumeImageStream(response, callbacks)
}

/** Non-streaming image edit (img2img) via multipart POST /v1/images/edits. */
export async function editImage(
  req: ImageEditRequest,
  apiKey: string
): Promise<ImageGenerationResponse> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await api.post(
        IMAGE_EDIT_ENDPOINT,
        buildEditFormData(req),
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

/** Streaming image edit. Forces b64_json so partial frames render inline. */
export async function editImageStream(
  req: ImageEditRequest,
  apiKey: string,
  callbacks: ImageStreamCallbacks = {}
): Promise<ImageDataItem> {
  const formData = buildEditFormData({
    ...req,
    stream: true,
    response_format: 'url',
  })

  const response = await fetch(IMAGE_EDIT_ENDPOINT, {
    method: 'POST',
    headers: {
      // No Content-Type: the browser sets the multipart boundary for FormData.
      Accept: 'text/event-stream',
      Authorization: `Bearer ${apiKey}`,
      'Cache-Control': 'no-store',
    },
    body: formData,
    credentials: 'include',
    signal: callbacks.signal,
  })

  return consumeImageStream(response, callbacks)
}
