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
import {
  carryOverInFlightItems,
  isSyncableItem,
  toRemoteHistoryItem,
} from './remote-history'
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

  test('false when not yet successful (in-flight)', () => {
    assert.equal(isSyncableItem(baseItem({ status: 'loading', images: [] })), false)
    assert.equal(
      isSyncableItem(baseItem({ status: 'streaming', images: [] })),
      false
    )
  })

  test('false when success but no images', () => {
    assert.equal(isSyncableItem(baseItem({ images: [] })), false)
  })

  test('true for terminal error items (so the failure persists)', () => {
    assert.equal(
      isSyncableItem(
        baseItem({ status: 'error', images: [], errorMessage: 'boom' })
      ),
      true
    )
  })

  test('false for an error item that still carries base64', () => {
    assert.equal(
      isSyncableItem(
        baseItem({ status: 'error', images: [{ b64_json: 'AAAA' }] })
      ),
      false
    )
  })
})

describe('toRemoteHistoryItem', () => {
  test('strips heavy/ephemeral fields but keeps the failure reason', () => {
    const item = baseItem({
      mode: 'edit',
      inputImages: [{ id: 'r1', name: 'r.png', mime: 'image/png', b64: 'BIG' }],
      maskImage: { id: 'm1', name: 'm.png', mime: 'image/png', b64: 'BIG' },
      partialImage: 'PARTIAL',
      taskId: 'task-123',
      status: 'error',
      images: [],
      errorMessage: 'boom',
    })
    const slim = toRemoteHistoryItem(item)
    assert.equal('inputImages' in slim, false)
    assert.equal('maskImage' in slim, false)
    assert.equal('partialImage' in slim, false)
    assert.equal('taskId' in slim, false)
    // errorMessage is kept so a synced failure shows its reason on every device.
    assert.equal(slim.errorMessage, 'boom')
    assert.equal(slim.status, 'error')
    assert.equal(slim.prompt, 'a cat')
    assert.equal(slim.mode, 'edit')
  })
})

describe('carryOverInFlightItems', () => {
  test('carries over local in-flight async-task items not on the server', () => {
    const remote = [baseItem({ id: 'done-1', status: 'success' })]
    const local = [
      {
        ...baseItem({ id: 'task-1', status: 'loading', images: [] }),
        taskId: 'srv-1',
      },
      baseItem({ id: 'done-1', status: 'success' }),
    ]
    const merged = carryOverInFlightItems(remote, local)
    // In-flight task item is prepended (newest), server history follows.
    assert.deepEqual(
      merged.map((it) => it.id),
      ['task-1', 'done-1']
    )
    assert.equal(merged[0].taskId, 'srv-1')
    assert.equal(merged[0].status, 'loading')
  })

  test('drops local loading items without a taskId (cannot resume)', () => {
    const remote: ImageGenerationItem[] = []
    const local = [baseItem({ id: 'x', status: 'loading', images: [] })]
    assert.deepEqual(carryOverInFlightItems(remote, local), [])
  })

  test('does not carry over already-finished local items', () => {
    const remote: ImageGenerationItem[] = []
    const local = [
      baseItem({ id: 'ok', status: 'success' }),
      baseItem({ id: 'err', status: 'error', images: [] }),
    ]
    assert.deepEqual(carryOverInFlightItems(remote, local), [])
  })

  test('server copy wins when the same id is in-flight locally but done on server', () => {
    const remote = [baseItem({ id: 'task-1', status: 'success' })]
    const local = [
      {
        ...baseItem({ id: 'task-1', status: 'loading', images: [] }),
        taskId: 'srv-1',
      },
    ]
    const merged = carryOverInFlightItems(remote, local)
    assert.equal(merged.length, 1)
    assert.equal(merged[0].status, 'success')
  })
})
