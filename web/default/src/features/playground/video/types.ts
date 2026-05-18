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
export interface VideoGenerationRequest {
  model: string
  prompt: string
  image?: string
  duration?: number
  width?: number
  height?: number
  fps?: number
  seed?: number
  n?: number
  metadata?: Record<string, unknown>
}

export interface VideoSubmitResponse {
  task_id: string
  status: string
}

// matches backend dto.VideoTaskResponse
export interface VideoFetchResponse {
  task_id: string
  status: 'queued' | 'in_progress' | 'succeeded' | 'failed' | string
  url?: string
  format?: string
  metadata?: {
    duration?: number
    fps?: number
    width?: number
    height?: number
    seed?: number
  }
  error?: { code?: number; message?: string }
}

export interface VideoConfig {
  model: string
  duration: number
  width: number
  height: number
  fps: number
  negativePrompt: string
}

export type VideoTaskStatus =
  | 'submitting'
  | 'queued'
  | 'in_progress'
  | 'succeeded'
  | 'failed'

export interface VideoTaskItem {
  id: string // local id
  taskId?: string // server task id
  prompt: string
  image?: string
  model: string
  duration: number
  width: number
  height: number
  fps: number
  createdAt: number
  status: VideoTaskStatus
  url?: string
  format?: string
  errorMessage?: string
}
