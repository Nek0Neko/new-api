import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  base64ToBlob,
  blobToBase64,
  fileToImageInputFile,
} from './image-encoding'

// "hello" in base64
const HELLO_B64 = 'aGVsbG8='

describe('image-encoding', () => {
  test('base64ToBlob produces a Blob with the right type and bytes', async () => {
    const blob = base64ToBlob(HELLO_B64, 'image/png')
    assert.equal(blob.type, 'image/png')
    assert.equal(await blob.text(), 'hello')
  })

  test('blobToBase64 round-trips', async () => {
    const blob = new Blob(['hello'], { type: 'image/png' })
    assert.equal(await blobToBase64(blob), HELLO_B64)
  })

  test('fileToImageInputFile reads name, mime and base64', async () => {
    const file = new File(['hello'], 'cat.png', { type: 'image/png' })
    const out = await fileToImageInputFile(file)
    assert.equal(out.name, 'cat.png')
    assert.equal(out.mime, 'image/png')
    assert.equal(out.b64, HELLO_B64)
    assert.ok(out.id.length > 0)
  })
})
