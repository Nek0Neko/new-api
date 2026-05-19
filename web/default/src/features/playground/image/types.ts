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
  quality: string
  n: number
  stream: boolean
  partialImages: number
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
  createdAt: number
  status: ImageGenerationStatus
  images: ImageDataItem[]
  /**
   * Latest partial image (base64) received while streaming. Cleared when the
   * final completed image is rendered.
   */
  partialImage?: string
  errorMessage?: string
}
