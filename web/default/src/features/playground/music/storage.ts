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
import type { MusicConfig, MusicTaskItem } from './types'

const CONFIG_KEY = 'playground_music_config'
const ITEMS_KEY = 'playground_music_items'

export const DEFAULT_MUSIC_CONFIG: MusicConfig = {
  mode: 'description',
  model: '',
  mv: 'chirp-v3-5',
  title: '',
  tags: '',
  makeInstrumental: false,
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

export function loadMusicConfig(): MusicConfig {
  if (typeof window === 'undefined') return DEFAULT_MUSIC_CONFIG
  const saved = safeParse<Partial<MusicConfig>>(
    window.localStorage.getItem(CONFIG_KEY)
  )
  return { ...DEFAULT_MUSIC_CONFIG, ...(saved ?? {}) }
}

export function saveMusicConfig(config: MusicConfig): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch {
    // ignore quota errors
  }
}

export function loadMusicItems(): MusicTaskItem[] {
  if (typeof window === 'undefined') return []
  return (
    safeParse<MusicTaskItem[]>(window.localStorage.getItem(ITEMS_KEY)) ?? []
  )
}

export function saveMusicItems(items: MusicTaskItem[]): void {
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
