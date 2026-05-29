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
import { normalizeImageConfig, DEFAULT_IMAGE_CONFIG } from './storage'

describe('normalizeImageConfig', () => {
  test('returns defaults for empty input', () => {
    assert.deepEqual(normalizeImageConfig(undefined), DEFAULT_IMAGE_CONFIG)
  })

  test('migrates legacy quality standard/hd to auto', () => {
    assert.equal(normalizeImageConfig({ quality: 'hd' }).quality, 'auto')
    assert.equal(normalizeImageConfig({ quality: 'standard' }).quality, 'auto')
  })

  test('keeps valid new quality values', () => {
    assert.equal(normalizeImageConfig({ quality: 'high' }).quality, 'high')
  })

  test('forces compression null when format is png', () => {
    assert.equal(
      normalizeImageConfig({ outputFormat: 'png', outputCompression: 50 })
        .outputCompression,
      null
    )
  })

  test('keeps compression for jpeg within range', () => {
    assert.equal(
      normalizeImageConfig({ outputFormat: 'jpeg', outputCompression: 80 })
        .outputCompression,
      80
    )
  })

  test('clamps out-of-range compression to null', () => {
    assert.equal(
      normalizeImageConfig({ outputFormat: 'webp', outputCompression: 999 })
        .outputCompression,
      null
    )
  })

  test('preserves compression value of 0 for jpeg', () => {
    assert.equal(
      normalizeImageConfig({ outputFormat: 'jpeg', outputCompression: 0 })
        .outputCompression,
      0
    )
  })

  test('returns defaults for non-object primitive input', () => {
    assert.deepEqual(normalizeImageConfig(42), DEFAULT_IMAGE_CONFIG)
  })
})
