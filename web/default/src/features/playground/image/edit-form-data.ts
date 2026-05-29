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
import { base64ToBlob } from './image-encoding'
import type { ImageEditRequest } from './types'

/**
 * Build a multipart FormData body for POST /v1/images/edits. Single image uses
 * the `image` field; multiple use `image[]` (both accepted by the backend
 * OpenAI adaptor). A mask, when present, is appended as `mask`.
 */
export function buildEditFormData(req: ImageEditRequest): FormData {
  const fd = new FormData()
  fd.append('model', req.model)
  fd.append('prompt', req.prompt)
  if (req.n != null) fd.append('n', String(req.n))
  if (req.size) fd.append('size', req.size)
  if (req.quality) fd.append('quality', req.quality)
  if (req.output_format) fd.append('output_format', req.output_format)
  if (req.output_compression != null) {
    fd.append('output_compression', String(req.output_compression))
  }
  if (req.moderation) fd.append('moderation', req.moderation)
  if (req.response_format) fd.append('response_format', req.response_format)
  if (req.stream) {
    fd.append('stream', 'true')
    if (req.partial_images != null) {
      fd.append('partial_images', String(req.partial_images))
    }
  }

  const field = req.images.length > 1 ? 'image[]' : 'image'
  for (const image of req.images) {
    fd.append(field, base64ToBlob(image.b64, image.mime), image.name)
  }
  if (req.mask) {
    fd.append('mask', base64ToBlob(req.mask.b64, req.mask.mime), req.mask.name)
  }
  return fd
}
