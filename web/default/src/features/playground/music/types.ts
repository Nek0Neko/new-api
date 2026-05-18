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
export type MusicMode = 'description' | 'custom'

export interface MusicSubmitRequest {
  model?: string
  gpt_description_prompt?: string
  prompt?: string
  mv?: string
  title?: string
  tags?: string
  make_instrumental?: boolean
}

export interface MusicClip {
  id: string
  title?: string
  audioUrl?: string
  videoUrl?: string
  imageUrl?: string
  lyrics?: string
  status?: string
}

export type MusicTaskStatus =
  | 'submitting'
  | 'queued'
  | 'in_progress'
  | 'succeeded'
  | 'failed'

export interface MusicTaskItem {
  id: string
  taskId?: string
  mode: MusicMode
  model: string
  description: string
  prompt: string
  title: string
  tags: string
  makeInstrumental: boolean
  createdAt: number
  status: MusicTaskStatus
  clips: MusicClip[]
  errorMessage?: string
}

export interface MusicConfig {
  mode: MusicMode
  model: string
  mv: string
  title: string
  tags: string
  makeInstrumental: boolean
}
