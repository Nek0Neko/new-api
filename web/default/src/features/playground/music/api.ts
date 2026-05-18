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
import type { MusicClip, MusicSubmitRequest } from './types'

const SUBMIT_PATH = '/suno/submit'
const FETCH_PATH = '/suno/fetch'

export interface MusicSubmitResponse {
  taskId: string
}

export interface MusicFetchResponse {
  status: string
  clips: MusicClip[]
  failReason?: string
}

// Submit response: dto.TaskResponse[string] = { code, message, data: "<task_id>" }
function normalizeSubmitResponse(raw: unknown): MusicSubmitResponse {
  const obj = (raw ?? {}) as Record<string, unknown>
  if (typeof obj.data === 'string' && obj.data) {
    return { taskId: obj.data }
  }
  if (obj.data && typeof obj.data === 'object') {
    const inner = obj.data as Record<string, unknown>
    if (typeof inner.task_id === 'string') return { taskId: inner.task_id }
  }
  if (typeof obj.task_id === 'string') return { taskId: obj.task_id }
  return { taskId: '' }
}

// Fetch response: dto.TaskResponse[any] with data = TaskDto. TaskDto.data is
// a raw json payload (typically the upstream Suno clips array).
function normalizeFetchResponse(raw: unknown): MusicFetchResponse {
  const obj = (raw ?? {}) as Record<string, unknown>
  const task = (obj.data ?? obj) as Record<string, unknown>
  const status = typeof task.status === 'string' ? task.status : 'unknown'
  const failReason =
    typeof task.fail_reason === 'string' ? task.fail_reason : undefined

  let clipsRaw: unknown = task.data
  // The backend stores upstream payload as json.RawMessage; some backends
  // ship a json string instead of a parsed array.
  if (typeof clipsRaw === 'string') {
    try {
      clipsRaw = JSON.parse(clipsRaw)
    } catch {
      clipsRaw = []
    }
  }

  const clipsArr = Array.isArray(clipsRaw) ? clipsRaw : []
  const clips: MusicClip[] = clipsArr.map((entry, idx) => {
    const c = (entry ?? {}) as Record<string, unknown>
    return {
      id: (typeof c.id === 'string' && c.id) || `clip-${idx}`,
      title: typeof c.title === 'string' ? c.title : undefined,
      audioUrl: typeof c.audio_url === 'string' ? c.audio_url : undefined,
      videoUrl: typeof c.video_url === 'string' ? c.video_url : undefined,
      imageUrl:
        (typeof c.image_url === 'string' && c.image_url) ||
        (typeof c.image_large_url === 'string' && c.image_large_url) ||
        undefined,
      lyrics: typeof c.text === 'string' ? c.text : undefined,
      status: typeof c.status === 'string' ? c.status : undefined,
    }
  })

  return { status, clips, failReason }
}

export async function submitMusic(
  action: 'music' | 'lyrics',
  payload: MusicSubmitRequest,
  apiKey: string
): Promise<MusicSubmitResponse> {
  const res = await api.post(
    `${SUBMIT_PATH}/${action}`,
    payload,
    bearerConfig(apiKey)
  )
  return normalizeSubmitResponse(res.data)
}

export async function fetchMusicTask(
  taskId: string,
  apiKey: string
): Promise<MusicFetchResponse> {
  const res = await api.get(
    `${FETCH_PATH}/${encodeURIComponent(taskId)}`,
    bearerConfig(apiKey)
  )
  return normalizeFetchResponse(res.data)
}
