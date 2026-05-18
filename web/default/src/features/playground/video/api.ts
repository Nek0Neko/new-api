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
import type {
  VideoFetchResponse,
  VideoGenerationRequest,
  VideoSubmitResponse,
} from './types'

const SUBMIT_ENDPOINT = '/v1/video/generations'

// Submit responses come back as the upstream-specific shape (typically the
// OpenAIVideo flat object: { id, task_id, status, ... }). Extract the bits we
// care about defensively so we can interoperate with multiple adapters.
function normalizeSubmitResponse(raw: unknown): VideoSubmitResponse {
  const obj = (raw ?? {}) as Record<string, unknown>
  const taskId =
    (typeof obj.task_id === 'string' && obj.task_id) ||
    (typeof obj.id === 'string' && obj.id) ||
    ''
  const status = typeof obj.status === 'string' ? obj.status : 'queued'
  return { task_id: taskId, status }
}

// Fetch responses are wrapped: { code: "success", data: { task_id, status,
// result_url, fail_reason, ... } } (the generic TaskDto). Unwrap and surface
// the fields the UI needs.
function normalizeFetchResponse(raw: unknown): VideoFetchResponse {
  const obj = (raw ?? {}) as Record<string, unknown>
  const data = (obj.data ?? obj) as Record<string, unknown>
  const taskId =
    (typeof data.task_id === 'string' && data.task_id) ||
    (typeof data.id === 'string' && data.id) ||
    ''
  const status = typeof data.status === 'string' ? data.status : 'unknown'
  const url =
    (typeof data.result_url === 'string' && data.result_url) ||
    (typeof data.url === 'string' && data.url) ||
    undefined
  const failMessage =
    (typeof data.fail_reason === 'string' && data.fail_reason) ||
    (typeof (data.error as Record<string, unknown> | undefined)?.message ===
      'string' &&
      ((data.error as Record<string, unknown>).message as string)) ||
    undefined
  const meta = data.metadata as VideoFetchResponse['metadata']
  return {
    task_id: taskId,
    status,
    url,
    format: typeof data.format === 'string' ? data.format : undefined,
    metadata: meta,
    error: failMessage ? { message: failMessage } : undefined,
  }
}

export async function submitVideo(
  payload: VideoGenerationRequest,
  apiKey: string
): Promise<VideoSubmitResponse> {
  const res = await api.post(SUBMIT_ENDPOINT, payload, bearerConfig(apiKey))
  return normalizeSubmitResponse(res.data)
}

export async function fetchVideoTask(
  taskId: string,
  apiKey: string
): Promise<VideoFetchResponse> {
  const res = await api.get(
    `${SUBMIT_ENDPOINT}/${encodeURIComponent(taskId)}`,
    bearerConfig(apiKey)
  )
  return normalizeFetchResponse(res.data)
}
