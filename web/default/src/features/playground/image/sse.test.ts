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

  test('falls back to the last partial when no completed event arrives', async () => {
    const partials: string[] = []
    const res = sseResponse([
      JSON.stringify({
        type: 'image_generation.partial_image',
        b64_json: 'AAA',
        partial_image_index: 0,
        revised_prompt: 'rp',
      }),
      JSON.stringify({
        type: 'image_generation.partial_image',
        b64_json: 'BBB',
        partial_image_index: 1,
      }),
      '[DONE]',
    ])
    const final = await consumeImageStream(res, {
      onPartial: (b64) => partials.push(b64),
    })
    assert.deepEqual(partials, ['AAA', 'BBB'])
    assert.equal(final.b64_json, 'BBB')
    assert.equal(final.url, undefined)
    assert.equal(final.revised_prompt, 'rp')
  })

  test('resolves on the completed event even if the stream never closes', async () => {
    // Some upstreams emit `completed` but then hold the SSE connection open
    // (kept alive by server pings) without ever sending [DONE] or closing.
    // consumeImageStream must resolve from the completed event rather than
    // block forever waiting for the reader to finish.
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const completed = JSON.stringify({
          type: 'image_generation.completed',
          url: 'https://cdn.test/final.png',
          revised_prompt: 'rp',
        })
        controller.enqueue(new TextEncoder().encode(`data: ${completed}\n`))
        // Intentionally never close: emulate a held-open connection.
      },
      cancel() {
        cancelled = true
      },
    })
    const res = new Response(stream, { status: 200 })

    const final = await Promise.race([
      consumeImageStream(res, {}),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timed out: stream did not resolve')), 1000)
      ),
    ])
    assert.equal((final as { url?: string }).url, 'https://cdn.test/final.png')
    assert.equal(cancelled, true)
  })

  test('prefers url over b64_json on the completed image', async () => {
    const res = sseResponse([
      JSON.stringify({
        type: 'image_generation.completed',
        url: 'https://cdn.test/final.png',
        revised_prompt: 'rp',
      }),
      '[DONE]',
    ])
    const final = await consumeImageStream(res, {})
    assert.equal(final.url, 'https://cdn.test/final.png')
    assert.equal(final.b64_json, undefined)
    assert.equal(final.revised_prompt, 'rp')
  })
})
