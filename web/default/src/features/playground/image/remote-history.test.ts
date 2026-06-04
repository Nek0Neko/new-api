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
import { isSyncableItem, toRemoteHistoryItem } from './remote-history'
import type { ImageGenerationItem } from './types'

function baseItem(overrides: Partial<ImageGenerationItem>): ImageGenerationItem {
  return {
    id: 'img-1',
    prompt: 'a cat',
    model: 'gpt-image-1',
    size: 'auto',
    quality: 'auto',
    mode: 'generation',
    createdAt: 1,
    status: 'success',
    images: [{ url: 'https://cos.example.com/a.png' }],
    ...overrides,
  }
}

describe('isSyncableItem', () => {
  test('true when success with COS URL outputs', () => {
    assert.equal(isSyncableItem(baseItem({})), true)
  })

  test('false when an output is base64 (COS disabled)', () => {
    assert.equal(
      isSyncableItem(baseItem({ images: [{ b64_json: 'AAAA' }] })),
      false
    )
  })

  test('false when not yet successful', () => {
    assert.equal(isSyncableItem(baseItem({ status: 'loading', images: [] })), false)
  })

  test('false when success but no images', () => {
    assert.equal(isSyncableItem(baseItem({ images: [] })), false)
  })
})

describe('toRemoteHistoryItem', () => {
  test('strips heavy/ephemeral fields, keeps params + image URLs', () => {
    const item = baseItem({
      mode: 'edit',
      inputImages: [{ id: 'r1', name: 'r.png', mime: 'image/png', b64: 'BIG' }],
      maskImage: { id: 'm1', name: 'm.png', mime: 'image/png', b64: 'BIG' },
      partialImage: 'PARTIAL',
      taskId: 'task-123',
      errorMessage: 'should be dropped',
    })
    const slim = toRemoteHistoryItem(item)
    assert.equal('inputImages' in slim, false)
    assert.equal('maskImage' in slim, false)
    assert.equal('partialImage' in slim, false)
    assert.equal('taskId' in slim, false)
    assert.equal('errorMessage' in slim, false)
    assert.equal(slim.prompt, 'a cat')
    assert.equal(slim.mode, 'edit')
    assert.deepEqual(slim.images, [{ url: 'https://cos.example.com/a.png' }])
  })
})
