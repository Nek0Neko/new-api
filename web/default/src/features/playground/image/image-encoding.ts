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
import type { ImageInputFile } from './types'

/** Decode raw base64 (no data-URL prefix) into a typed Blob. */
export function base64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

/** Encode a Blob/File into raw base64 (strips the data-URL prefix). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function generateInputId(): string {
  return `in-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Read a browser File into an ImageInputFile (base64 payload). */
export async function fileToImageInputFile(file: File): Promise<ImageInputFile> {
  const b64 = await blobToBase64(file)
  return {
    id: generateInputId(),
    name: file.name || 'image.png',
    mime: file.type || 'image/png',
    b64,
  }
}

/** Build a data URL for rendering an ImageInputFile in an <img>. */
export function imageInputFileToDataUrl(input: ImageInputFile): string {
  return `data:${input.mime};base64,${input.b64}`
}
