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
  getAtImageQuery,
  getPromptMentionParts,
  getSelectedImageMentionLabel,
  getSelectedTextMentionLabel,
  insertImageMention,
  insertTextMentionAtVisibleRange,
  isCursorInSelectedImageMention,
  remapImageMentionsForOrder,
  replaceImageMentionsForApi,
} from './prompt-mentions'
import type { ImageInputFile } from './types'

const images: ImageInputFile[] = [
  { id: 'image-a', name: 'a.png', mime: 'image/png', b64: 'a' },
  { id: 'image-b', name: 'b.png', mime: 'image/png', b64: 'b' },
]

describe('prompt image mentions', () => {
  test('detects @ query after the cursor', () => {
    assert.deepEqual(getAtImageQuery('参考 @图', 5, images), {
      start: 3,
      query: '图',
    })
  })

  test('ignores @ query when there are no current reference images', () => {
    assert.equal(getAtImageQuery('参考 @图', 5, []), null)
  })

  test('keeps a completed image mention query selectable', () => {
    assert.deepEqual(getAtImageQuery('参考 @图2', 6, images), {
      start: 3,
      query: '图2',
    })
  })

  test('detects @ query in the middle of text without requiring whitespace prefix', () => {
    assert.deepEqual(getAtImageQuery('参考@', 3, images), {
      start: 2,
      query: '',
    })
  })

  test('replaces middle-text @ query with selected current reference image mention', () => {
    assert.deepEqual(insertImageMention('参考@生成', 2, 3, 1), {
      prompt: `参考${getSelectedImageMentionLabel(1)}生成`,
      cursor: 5,
    })
  })

  test('does not add extra spaces around line breaks when inserting mentions', () => {
    assert.deepEqual(insertImageMention('参考\n@\n生成', 3, 4, 0), {
      prompt: `参考\n${getSelectedImageMentionLabel(0)}\n生成`,
      cursor: 6,
    })
  })

  test('inserts selected agent round image mentions', () => {
    assert.deepEqual(
      insertTextMentionAtVisibleRange('参考@生成', 2, 3, '@第1轮图2'),
      {
        prompt: `参考${getSelectedTextMentionLabel('@第1轮图2')}生成`,
        cursor: 8,
      }
    )
  })

  test('splits valid image mentions for tag rendering', () => {
    assert.deepEqual(
      getPromptMentionParts(
        `用${getSelectedImageMentionLabel(1)}的方式生成@图9`,
        images
      ),
      [
        { type: 'text', text: '用' },
        { type: 'mention', text: '@图2', imageIndex: 1 },
        { type: 'text', text: '的方式生成@图9' },
      ]
    )
  })

  test('keeps manually typed mentions as plain text', () => {
    assert.deepEqual(getPromptMentionParts('用@图2的方式生成', images), [
      { type: 'text', text: '用@图2的方式生成' },
    ])
  })

  test('detects cursor inside selected image mentions', () => {
    const prompt = `参考 ${getSelectedImageMentionLabel(1)} 生成`

    assert.equal(isCursorInSelectedImageMention(prompt, 6), true)
    assert.equal(isCursorInSelectedImageMention(prompt, 3), false)
    assert.equal(isCursorInSelectedImageMention(prompt, 7), false)
    assert.equal(isCursorInSelectedImageMention('参考 @图2 生成', 6), false)
  })

  describe('remapImageMentionsForOrder', () => {
    test('keeps mentions attached to the same image after reordering', () => {
      assert.equal(
        remapImageMentionsForOrder(
          `用 ${getSelectedImageMentionLabel(1)} 参考 ${getSelectedImageMentionLabel(0)}`,
          images,
          [images[1], images[0]]
        ),
        `用 ${getSelectedImageMentionLabel(0)} 参考 ${getSelectedImageMentionLabel(1)}`
      )
    })

    test('marks removed image mentions as unavailable', () => {
      assert.equal(
        remapImageMentionsForOrder(
          `用 ${getSelectedImageMentionLabel(1)}`,
          images,
          [images[0]]
        ),
        '用 @已移除图片'
      )
    })

    test('keeps mentions attached when an image id is replaced with an equivalent id', () => {
      const replacement: ImageInputFile = {
        id: 'image-b-replacement',
        name: 'b.png',
        mime: 'image/png',
        b64: images[1].b64,
      }

      assert.equal(
        remapImageMentionsForOrder(
          `用 ${getSelectedImageMentionLabel(1)}`,
          images,
          [images[0], replacement],
          { [images[1].id]: replacement.id }
        ),
        `用 ${getSelectedImageMentionLabel(1)}`
      )
    })
  })

  describe('replaceImageMentionsForApi', () => {
    test('replaces single mention', () => {
      assert.equal(
        replaceImageMentionsForApi(
          `把 ${getSelectedImageMentionLabel(0)} 变蓝`
        ),
        '把 [image 1] 变蓝'
      )
    })

    test('replaces multiple mentions', () => {
      assert.equal(
        replaceImageMentionsForApi(
          `把 ${getSelectedImageMentionLabel(1)} 的背景换到 ${getSelectedImageMentionLabel(0)} 上`
        ),
        '把 [image 2] 的背景换到 [image 1] 上'
      )
    })

    test('does not replace manually typed mentions', () => {
      assert.equal(replaceImageMentionsForApi('把 @图1 变蓝'), '把 @图1 变蓝')
    })

    test('returns prompt unchanged when no mentions', () => {
      assert.equal(replaceImageMentionsForApi('生成一只猫'), '生成一只猫')
    })

    test('does not replace mentions outside the current image range', () => {
      assert.equal(
        replaceImageMentionsForApi(
          `把 ${getSelectedImageMentionLabel(2)} 变蓝`,
          2
        ),
        '把 @图3 变蓝'
      )
    })
  })
})
