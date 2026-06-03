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
export interface ImageGenerationRequest {
  model: string
  prompt: string
  n?: number
  size?: string
  quality?: string
  output_format?: 'png' | 'jpeg' | 'webp'
  output_compression?: number
  moderation?: 'auto' | 'low'
  response_format?: 'url' | 'b64_json'
  stream?: boolean
  partial_images?: number
}

export interface ImageDataItem {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export interface ImageGenerationResponse {
  created: number
  data: ImageDataItem[]
}

export interface ImageConfig {
  model: string
  size: string
  quality: 'auto' | 'low' | 'medium' | 'high'
  outputFormat: 'png' | 'jpeg' | 'webp'
  /** 0–100; null when not applicable (PNG, or unset). */
  outputCompression: number | null
  moderation: 'auto' | 'low'
  n: number
  stream: boolean
  partialImages: number
  /**
   * Run generation as a server-side async task: submit returns immediately and
   * the result is polled, so the user can leave the page / refresh / close the
   * browser and still retrieve it. Mutually exclusive with `stream` (a task
   * cannot stream); when true, streaming is ignored.
   */
  asyncTask: boolean
}

export type ImageGenerationStatus =
  | 'loading'
  | 'streaming'
  | 'success'
  | 'error'

export interface ImageGenerationItem {
  id: string
  prompt: string
  model: string
  size: string
  quality: string
  /** Whether this item used text-to-image or image edit. */
  mode: 'generation' | 'edit'
  /** Reference images used for an edit (base64). Present only for edits. */
  inputImages?: ImageInputFile[]
  /** Mask used for an edit (base64). Present only when the user painted one. */
  maskImage?: ImageInputFile
  createdAt: number
  status: ImageGenerationStatus
  /**
   * Full config snapshot taken when this item was first submitted. Lets the
   * "Regenerate" action retry the original message in place with its original
   * parameters (n / moderation / format / stream / async / partial images),
   * not just whatever the config panel currently shows. Optional for backward
   * compatibility with items persisted before this field existed — retry falls
   * back to the current config when absent.
   */
  config?: ImageConfig
  /**
   * Server-side async task id (when this item was submitted as a task). Used to
   * resume polling after a reload and to keep a `loading` item alive instead of
   * surfacing it as interrupted.
   */
  taskId?: string
  images: ImageDataItem[]
  /**
   * Latest partial image (base64) received while streaming. Cleared when the
   * final completed image is rendered.
   */
  partialImage?: string
  errorMessage?: string
}

export interface ImageInputFile {
  id: string
  name: string
  /** MIME type, e.g. "image/png". */
  mime: string
  /** Raw base64 (no data-URL prefix). */
  b64: string
}

export interface ImageEditRequest {
  model: string
  prompt: string
  n?: number
  size?: string
  quality?: string
  output_format?: 'png' | 'jpeg' | 'webp'
  output_compression?: number
  moderation?: 'auto' | 'low'
  response_format?: 'url' | 'b64_json'
  stream?: boolean
  partial_images?: number
  /** One or more reference images to edit. */
  images: ImageInputFile[]
  /** Optional mask: transparent areas mark where to edit. */
  mask?: ImageInputFile
}
