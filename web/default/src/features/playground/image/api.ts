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
import { api } from '@/lib/api'
import { bearerConfig } from '../shared/request-config'
import { buildEditFormData } from './edit-form-data'
import type {
  ImageEditRequest,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from './types'

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
  apiKey: string,
  itemId: string
): Promise<ImageTaskSubmitResponse> {
  const config = bearerConfig(apiKey)
  // Stable client id so the server keys this task's history row to the card.
  config.headers = { ...config.headers, 'X-Playground-Item-Id': itemId }
  const res = await api.post(IMAGE_GEN_TASK_ENDPOINT, payload, config)
  return res.data
}

/** Submit an image→image edit (multipart) as a server-side async task. */
export async function submitImageEditTask(
  req: ImageEditRequest,
  apiKey: string,
  itemId: string
): Promise<ImageTaskSubmitResponse> {
  const config = bearerConfig(apiKey)
  config.headers = { ...config.headers, 'X-Playground-Item-Id': itemId }
  const res = await api.post(IMAGE_EDIT_TASK_ENDPOINT, buildEditFormData(req), config)
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

