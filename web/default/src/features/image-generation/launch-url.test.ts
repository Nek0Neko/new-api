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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { buildImageGenerationLaunchUrl } from './launch-url'

describe('buildImageGenerationLaunchUrl', () => {
  test('appends apiUrl and apiKey to a plain external URL', () => {
    assert.equal(
      buildImageGenerationLaunchUrl({
        baseUrl: 'https://images.example.com',
        serverAddress: 'https://newapi.example.com',
        apiKey: 'sk-test',
      }),
      'https://images.example.com/?apiUrl=https%3A%2F%2Fnewapi.example.com%2Fv1&apiKey=sk-test'
    )
  })

  test('preserves existing query params and avoids a duplicate /v1 suffix', () => {
    assert.equal(
      buildImageGenerationLaunchUrl({
        baseUrl: 'https://images.example.com/play?model=gpt-image-1',
        serverAddress: 'https://newapi.example.com/v1/',
        apiKey: 'sk-test',
      }),
      'https://images.example.com/play?model=gpt-image-1&apiUrl=https%3A%2F%2Fnewapi.example.com%2Fv1&apiKey=sk-test'
    )
  })

  test('normalizes bare token values to sk-prefixed keys', () => {
    assert.equal(
      buildImageGenerationLaunchUrl({
        baseUrl: 'https://images.example.com',
        serverAddress: 'https://newapi.example.com',
        apiKey: 'abc123',
      }),
      'https://images.example.com/?apiUrl=https%3A%2F%2Fnewapi.example.com%2Fv1&apiKey=sk-abc123'
    )
  })
})
