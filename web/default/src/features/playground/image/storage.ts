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
import localforage from 'localforage'
import type { ImageConfig, ImageGenerationItem } from './types'

const CONFIG_KEY = 'playground_image_config'
const ITEMS_KEY = 'playground_image_items'

export const DEFAULT_IMAGE_CONFIG: ImageConfig = {
  model: '',
  size: 'auto',
  quality: 'auto',
  outputFormat: 'png',
  outputCompression: null,
  moderation: 'auto',
  n: 1,
  stream: false,
  partialImages: 1,
}

const QUALITY_VALUES = ['auto', 'low', 'medium', 'high'] as const
const FORMAT_VALUES = ['png', 'jpeg', 'webp'] as const
const MODERATION_VALUES = ['auto', 'low'] as const

export function normalizeImageConfig(raw: unknown): ImageConfig {
  const r = (
    raw !== null && typeof raw === 'object' ? raw : {}
  ) as Partial<ImageConfig>
  const quality = QUALITY_VALUES.includes(r.quality as never)
    ? (r.quality as ImageConfig['quality'])
    : 'auto' // migrates legacy 'standard' | 'hd' | undefined
  const outputFormat = FORMAT_VALUES.includes(r.outputFormat as never)
    ? (r.outputFormat as ImageConfig['outputFormat'])
    : 'png'
  const moderation = MODERATION_VALUES.includes(r.moderation as never)
    ? (r.moderation as ImageConfig['moderation'])
    : 'auto'
  const compression =
    typeof r.outputCompression === 'number' &&
    r.outputCompression >= 0 &&
    r.outputCompression <= 100
      ? r.outputCompression
      : null
  return {
    model: typeof r.model === 'string' ? r.model : DEFAULT_IMAGE_CONFIG.model,
    size: typeof r.size === 'string' && r.size ? r.size : 'auto',
    quality,
    outputFormat,
    outputCompression: outputFormat === 'png' ? null : compression,
    moderation,
    n: typeof r.n === 'number' && r.n >= 1 ? Math.floor(r.n) : 1,
    stream: typeof r.stream === 'boolean' ? r.stream : false,
    partialImages:
      typeof r.partialImages === 'number' && r.partialImages >= 0
        ? Math.floor(r.partialImages)
        : 1,
  }
}

// A single completed image is 3–5MB of base64, which blows past the
// ~5MB localStorage cap after one or two generations. Items live in
// IndexedDB (via localforage) where quota is typically a large fraction
// of free disk.
const itemsStore =
  typeof window === 'undefined'
    ? null
    : localforage.createInstance({
        name: 'new-api-playground',
        storeName: 'image_items',
        description:
          'Image playground history (base64 payloads up to several MB each)',
      })

const MAX_PERSISTED_ITEMS = 30

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

// Config is tiny (<1KB) — keep it on localStorage so the UI can read it
// synchronously on first render and avoid a hydration flash.
export function loadImageConfig(): ImageConfig {
  if (typeof window === 'undefined') return DEFAULT_IMAGE_CONFIG
  const saved = safeParse<Partial<ImageConfig>>(
    window.localStorage.getItem(CONFIG_KEY)
  )
  if (!saved) return DEFAULT_IMAGE_CONFIG
  return normalizeImageConfig(saved)
}

export function saveImageConfig(config: ImageConfig): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch (err) {
    console.warn('[playground/image] failed to persist config', err)
  }
}

// Stream placeholders left over from a previous session can never complete —
// the SSE connection died with the page. Surface them as errors so the UI
// doesn't show a forever-spinning card.
function reviveLoadedItem(item: ImageGenerationItem): ImageGenerationItem {
  if (item.status === 'streaming' || item.status === 'loading') {
    return {
      ...item,
      status: 'error',
      partialImage: undefined,
      errorMessage:
        item.errorMessage ??
        'Image generation was interrupted before completion.',
    }
  }
  return item
}

// One-shot migration of any leftover localStorage payload from before the
// IndexedDB switch. The localStorage entry is removed afterwards so this
// only runs once per browser.
async function migrateFromLocalStorage(): Promise<
  ImageGenerationItem[] | null
> {
  if (typeof window === 'undefined' || !itemsStore) return null
  const raw = window.localStorage.getItem(ITEMS_KEY)
  if (!raw) return null
  const parsed = safeParse<ImageGenerationItem[]>(raw)
  try {
    if (parsed && parsed.length > 0) {
      await itemsStore.setItem(ITEMS_KEY, parsed)
    }
  } catch (err) {
    console.warn('[playground/image] failed to migrate items to IndexedDB', err)
  } finally {
    window.localStorage.removeItem(ITEMS_KEY)
  }
  return parsed
}

export async function loadImageItems(): Promise<ImageGenerationItem[]> {
  if (typeof window === 'undefined' || !itemsStore) return []
  let items: ImageGenerationItem[] | null = null
  try {
    items = await itemsStore.getItem<ImageGenerationItem[]>(ITEMS_KEY)
  } catch (err) {
    console.warn('[playground/image] failed to read items from IndexedDB', err)
  }
  if (!items) {
    items = await migrateFromLocalStorage()
  }
  if (!items) return []
  return items.map(reviveLoadedItem)
}

// Produce a slimmed copy safe to persist:
// - Drop `partialImage` (ephemeral by design — see `types.ts`).
// - Drop the heavy output `images` payload for any not-yet-finalized item.
// - Keep `inputImages`/`maskImage` (carried by the spread) so edit items can
//   be regenerated after a reload.
function toPersistable(item: ImageGenerationItem): ImageGenerationItem {
  const { partialImage: _partial, ...rest } = item
  void _partial
  if (rest.status !== 'success') {
    return { ...rest, images: [] }
  }
  return rest
}

export async function saveImageItems(
  items: ImageGenerationItem[]
): Promise<void> {
  if (typeof window === 'undefined' || !itemsStore) return
  const trimmed = items.slice(0, MAX_PERSISTED_ITEMS).map(toPersistable)
  try {
    await itemsStore.setItem(ITEMS_KEY, trimmed)
  } catch (err) {
    // IndexedDB quota is huge, but still finite (per-origin, often a
    // percentage of free disk). On quota failure, drop oldest entries
    // until the write fits.
    const reduced = [...trimmed]
    while (reduced.length > 1) {
      reduced.pop()
      try {
        await itemsStore.setItem(ITEMS_KEY, reduced)
        console.warn(
          `[playground/image] IndexedDB quota exceeded; trimmed history to ${reduced.length} item(s)`
        )
        return
      } catch {
        // try again with fewer items
      }
    }
    console.warn('[playground/image] failed to persist items', err)
  }
}

export async function clearImageItems(): Promise<void> {
  if (typeof window === 'undefined' || !itemsStore) return
  try {
    await itemsStore.removeItem(ITEMS_KEY)
  } catch (err) {
    console.warn('[playground/image] failed to clear items', err)
  }
}
