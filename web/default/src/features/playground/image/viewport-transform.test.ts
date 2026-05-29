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
import { MAX_SCALE, zoomAtPoint } from './viewport-transform'

describe('zoomAtPoint', () => {
  const viewport = { width: 800, height: 600 }
  test('keeps the focus point stationary in image space', () => {
    const start = { scale: 1, x: 0, y: 0 }
    const focus = { x: 400, y: 300 }
    const next = zoomAtPoint(start, focus, 2, viewport)
    const before = {
      x: (focus.x - start.x) / start.scale,
      y: (focus.y - start.y) / start.scale,
    }
    const after = {
      x: (focus.x - next.x) / next.scale,
      y: (focus.y - next.y) / next.scale,
    }
    assert.ok(Math.abs(before.x - after.x) < 1e-6)
    assert.ok(Math.abs(before.y - after.y) < 1e-6)
  })
  test('clamps scale to the max', () => {
    const next = zoomAtPoint(
      { scale: 1, x: 0, y: 0 },
      { x: 0, y: 0 },
      999,
      viewport
    )
    assert.ok(next.scale <= MAX_SCALE)
  })
})
