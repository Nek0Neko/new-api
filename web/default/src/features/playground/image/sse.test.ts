import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { consumeImageStream } from './sse'

function sseResponse(lines: string[]): Response {
  const body = lines.map((l) => `data: ${l}\n`).join('')
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

describe('consumeImageStream', () => {
  test('emits partials and resolves with the completed image', async () => {
    const partials: string[] = []
    const res = sseResponse([
      JSON.stringify({
        type: 'image_generation.partial_image',
        b64_json: 'AAA',
        partial_image_index: 0,
      }),
      JSON.stringify({
        type: 'image_generation.completed',
        b64_json: 'BBB',
        revised_prompt: 'rp',
      }),
      '[DONE]',
    ])
    const final = await consumeImageStream(res, {
      onPartial: (b64) => partials.push(b64),
    })
    assert.deepEqual(partials, ['AAA'])
    assert.equal(final.b64_json, 'BBB')
    assert.equal(final.revised_prompt, 'rp')
  })

  test('throws on an error event', async () => {
    const res = sseResponse([JSON.stringify({ error: { message: 'boom' } })])
    await assert.rejects(() => consumeImageStream(res, {}), /boom/)
  })

  test('throws when the stream ends without a completed image', async () => {
    const res = sseResponse(['[DONE]'])
    await assert.rejects(
      () => consumeImageStream(res, {}),
      /without a completed image/
    )
  })
})
