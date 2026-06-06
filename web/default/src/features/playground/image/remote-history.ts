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
import type { ImageGenerationItem } from './types'

const HISTORY_ENDPOINT = '/api/playground/image/history'

// Fetch the user's server-side history (newest first). Each entry is a slimmed
// item document. Uses the session-auth axios instance (New-Api-User header).
export async function fetchRemoteHistory(): Promise<ImageGenerationItem[]> {
  const res = await api.get(HISTORY_ENDPOINT, { skipErrorHandler: true })
  const data = res.data?.data
  return Array.isArray(data) ? (data as ImageGenerationItem[]) : []
}

export async function deleteRemoteHistoryItem(itemId: string): Promise<void> {
  await api.delete(`${HISTORY_ENDPOINT}/${encodeURIComponent(itemId)}`, {
    skipErrorHandler: true,
  })
}

export async function clearRemoteHistory(): Promise<void> {
  await api.delete(HISTORY_ENDPOINT, { skipErrorHandler: true })
}

// Reconcile authoritative server history with the local cache at hydrate.
// The server is the source of truth for the set of items and their status, but
// some data lives only locally on the device that created it: base64 outputs
// (when COS is disabled, the server row's images are empty) and the config
// snapshot / edit input images (never synced). For each server item, graft
// those local-only fields from a same-id cached item when present.
export function reconcileHistory(
  remote: ImageGenerationItem[],
  local: ImageGenerationItem[]
): ImageGenerationItem[] {
  const localById = new Map(local.map((it) => [it.id, it]))
  return remote.map((item) => {
    const cached = localById.get(item.id)
    if (!cached) return item
    return {
      ...item,
      images: item.images.length > 0 ? item.images : cached.images,
      config: item.config ?? cached.config,
      inputImages: item.inputImages ?? cached.inputImages,
      maskImage: item.maskImage ?? cached.maskImage,
    }
  })
}
