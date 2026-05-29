import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { buildEditFormData } from './edit-form-data'
import type { ImageEditRequest, ImageInputFile } from './types'

const img = (id: string): ImageInputFile => ({
  id,
  name: `${id}.png`,
  mime: 'image/png',
  b64: 'aGVsbG8=',
})

describe('buildEditFormData', () => {
  test('single image uses the "image" field and scalar fields', () => {
    const req: ImageEditRequest = {
      model: 'gpt-image-1',
      prompt: 'make it blue',
      n: 2,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
      images: [img('a')],
    }
    const fd = buildEditFormData(req)
    assert.equal(fd.get('model'), 'gpt-image-1')
    assert.equal(fd.get('prompt'), 'make it blue')
    assert.equal(fd.get('n'), '2')
    assert.equal(fd.get('size'), '1024x1024')
    assert.equal(fd.get('quality'), 'standard')
    assert.equal(fd.get('response_format'), 'url')
    assert.equal(fd.getAll('image').length, 1)
    assert.ok(fd.get('image') instanceof Blob)
    assert.equal(fd.getAll('image[]').length, 0)
    assert.equal(fd.get('stream'), null)
  })

  test('multiple images use the "image[]" field', () => {
    const req: ImageEditRequest = {
      model: 'gpt-image-1',
      prompt: 'merge them',
      images: [img('a'), img('b')],
    }
    const fd = buildEditFormData(req)
    assert.equal(fd.getAll('image[]').length, 2)
    assert.equal(fd.getAll('image').length, 0)
  })

  test('stream adds stream + partial_images; mask is appended', () => {
    const req: ImageEditRequest = {
      model: 'gpt-image-1',
      prompt: 'inpaint',
      stream: true,
      partial_images: 2,
      images: [img('a')],
      mask: img('m'),
    }
    const fd = buildEditFormData(req)
    assert.equal(fd.get('stream'), 'true')
    assert.equal(fd.get('partial_images'), '2')
    assert.ok(fd.get('mask') instanceof Blob)
  })
})
