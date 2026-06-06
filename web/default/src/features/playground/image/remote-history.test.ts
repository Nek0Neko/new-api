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
import { reconcileHistory } from './remote-history'
import type { ImageGenerationItem } from './types'

function item(partial: Partial<ImageGenerationItem>): ImageGenerationItem {
  return {
    id: 'x',
    prompt: 'p',
    model: 'm',
    size: 'auto',
    quality: 'auto',
    mode: 'generation',
    createdAt: 0,
    status: 'success',
    images: [],
    ...partial,
  }
}

describe('reconcileHistory', () => {
  test('returns server items in order', () => {
    const remote = [item({ id: 'a' }), item({ id: 'b' })]
    const out = reconcileHistory(remote, [])
    assert.deepEqual(
      out.map((i) => i.id),
      ['a', 'b']
    )
  })

  test('grafts local images when the server row has none', () => {
    const remote = [item({ id: 'a', status: 'success', images: [] })]
    const local = [item({ id: 'a', images: [{ b64_json: 'AAAA' }] })]
    const out = reconcileHistory(remote, local)
    assert.deepEqual(out[0].images, [{ b64_json: 'AAAA' }])
  })

  test('keeps server images when present', () => {
    const remote = [item({ id: 'a', images: [{ url: 'https://s/x.png' }] })]
    const local = [item({ id: 'a', images: [{ b64_json: 'AAAA' }] })]
    const out = reconcileHistory(remote, local)
    assert.deepEqual(out[0].images, [{ url: 'https://s/x.png' }])
  })

  test('grafts local config when the server row lacks it', () => {
    const cfg = { model: 'm' } as ImageGenerationItem['config']
    const remote = [item({ id: 'a', config: undefined })]
    const local = [item({ id: 'a', config: cfg })]
    const out = reconcileHistory(remote, local)
    assert.equal(out[0].config, cfg)
  })

  test('drops local-only items (server is authoritative)', () => {
    const remote = [item({ id: 'a' })]
    const local = [item({ id: 'a' }), item({ id: 'ghost' })]
    const out = reconcileHistory(remote, local)
    assert.deepEqual(
      out.map((i) => i.id),
      ['a']
    )
  })
})
