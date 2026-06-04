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

// An item is safe to sync only when it has succeeded and every output is a COS
// URL (no base64). When COS is disabled the outputs are base64 — those stay
// local-only so the database never holds multi-MB blobs.
export function isSyncableItem(item: ImageGenerationItem): boolean {
  return (
    item.status === 'success' &&
    item.images.length > 0 &&
    item.images.every((img) => !!img.url && !img.b64_json)
  )
}

// Strip heavy/ephemeral fields before sending to the server: edit reference
// images and masks (raw base64), the streaming partial, the async task id, and
// any error message. What remains is params + COS image URLs.
export function toRemoteHistoryItem(
  item: ImageGenerationItem
): ImageGenerationItem {
  const {
    inputImages: _inputImages,
    maskImage: _maskImage,
    partialImage: _partialImage,
    taskId: _taskId,
    errorMessage: _errorMessage,
    ...rest
  } = item
  void _inputImages
  void _maskImage
  void _partialImage
  void _taskId
  void _errorMessage
  return rest
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
