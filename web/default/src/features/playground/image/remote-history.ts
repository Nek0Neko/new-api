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

// Which items get persisted server-side. Two terminal states sync:
//   - a success whose every output is a COS URL (never base64 — those stay
//     local-only so the database holds no multi-MB blobs), and
//   - a failure, so the user sees the task's error status on every device.
// In-flight items (loading/streaming) and base64 payloads are never synced.
export function isSyncableItem(item: ImageGenerationItem): boolean {
  // Base64 (COS-disabled) outputs must never reach the database.
  if (item.images.some((img) => !!img.b64_json)) return false
  if (item.status === 'error') return true
  return (
    item.status === 'success' &&
    item.images.length > 0 &&
    item.images.every((img) => !!img.url)
  )
}

// Strip heavy/ephemeral fields before sending to the server: edit reference
// images and masks (raw base64), the streaming partial, and the async task id.
// `errorMessage` is kept so a synced failure shows its reason on every device.
export function toRemoteHistoryItem(
  item: ImageGenerationItem
): ImageGenerationItem {
  const {
    inputImages: _inputImages,
    maskImage: _maskImage,
    partialImage: _partialImage,
    taskId: _taskId,
    ...rest
  } = item
  void _inputImages
  void _maskImage
  void _partialImage
  void _taskId
  return rest
}

// Reconcile the authoritative server history with the local cache at hydrate.
// The server only stores completed (success) items, so an async-task item that
// is still running was never synced. Carry those local in-flight items
// (status 'loading' with a resumable taskId) over — prepended as the newest —
// so their polling can resume after a page refresh instead of being lost.
// Items the server already knows about win (dedup by id), so a task that
// finished and synced elsewhere shows its completed server copy.
export function carryOverInFlightItems(
  remote: ImageGenerationItem[],
  local: ImageGenerationItem[]
): ImageGenerationItem[] {
  const remoteIds = new Set(remote.map((it) => it.id))
  const inFlight = local.filter(
    (it) => it.status === 'loading' && !!it.taskId && !remoteIds.has(it.id)
  )
  return [...inFlight, ...remote]
}

// Fetch the user's server-side history (newest first). Each entry is a slimmed
// item document. Uses the session-auth axios instance (New-Api-User header).
export async function fetchRemoteHistory(): Promise<ImageGenerationItem[]> {
  const res = await api.get(HISTORY_ENDPOINT, { skipErrorHandler: true })
  const data = res.data?.data
  return Array.isArray(data) ? (data as ImageGenerationItem[]) : []
}

export async function pushRemoteHistoryItem(
  item: ImageGenerationItem
): Promise<void> {
  await api.put(HISTORY_ENDPOINT, toRemoteHistoryItem(item), {
    skipErrorHandler: true,
  })
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
