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
import { calculateImageSize } from './size'

describe('calculateImageSize', () => {
  test('uses common 16:9 display resolutions for the built-in tiers', () => {
    assert.equal(calculateImageSize('1K', '16:9'), '1280x720')
    assert.equal(calculateImageSize('2K', '16:9'), '2560x1440')
    assert.equal(calculateImageSize('4K', '16:9'), '3840x2160')
  })

  test('uses matching portrait presets for common ratios', () => {
    assert.equal(calculateImageSize('2K', '9:16'), '1440x2560')
    assert.equal(calculateImageSize('2K', '2:3'), '1440x2160')
    assert.equal(calculateImageSize('2K', '3:4'), '1536x2048')
  })

  test('falls back to budget-based sizing for custom ratios', () => {
    assert.equal(calculateImageSize('2K', '5:4'), '2288x1824')
  })
})

describe('calculateImageSize presets', () => {
  test('4K + 4:3 resolves to 3200x2400 (matches mockup)', () => {
    assert.equal(calculateImageSize('4K', '4:3'), '3200x2400')
  })
})
