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
import type { VideoConfig, VideoTaskItem } from './types'

const CONFIG_KEY = 'playground_video_config'
const ITEMS_KEY = 'playground_video_items'

export const DEFAULT_VIDEO_CONFIG: VideoConfig = {
  model: '',
  duration: 5,
  width: 1280,
  height: 720,
  fps: 24,
  negativePrompt: '',
}

const MAX_PERSISTED_ITEMS = 30

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function loadVideoConfig(): VideoConfig {
  if (typeof window === 'undefined') return DEFAULT_VIDEO_CONFIG
  const saved = safeParse<Partial<VideoConfig>>(
    window.localStorage.getItem(CONFIG_KEY)
  )
  return { ...DEFAULT_VIDEO_CONFIG, ...(saved ?? {}) }
}

export function saveVideoConfig(config: VideoConfig): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch {
    // ignore quota errors
  }
}

export function loadVideoItems(): VideoTaskItem[] {
  if (typeof window === 'undefined') return []
  return (
    safeParse<VideoTaskItem[]>(window.localStorage.getItem(ITEMS_KEY)) ?? []
  )
}

export function saveVideoItems(items: VideoTaskItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      ITEMS_KEY,
      JSON.stringify(items.slice(0, MAX_PERSISTED_ITEMS))
    )
  } catch {
    // ignore quota errors
  }
}
