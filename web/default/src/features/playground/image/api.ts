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
import { bearerConfig } from '../shared/request-config'
import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
} from './types'

export const IMAGE_GEN_ENDPOINT = '/v1/images/generations'

export async function generateImage(
  payload: ImageGenerationRequest,
  apiKey: string
): Promise<ImageGenerationResponse> {
  const res = await api.post(IMAGE_GEN_ENDPOINT, payload, bearerConfig(apiKey))
  return res.data
}
