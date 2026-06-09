import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseApiEndpoints,
  resolveSelectedUrl,
  type ApiEndpoint,
} from './api-endpoints'

const MAIN = 'https://main.example.com'

test('main endpoint is always first with given label', () => {
  const list = parseApiEndpoints('', MAIN, 'Main site')
  assert.deepEqual(list, [{ label: 'Main site', url: MAIN }])
})

test('parses "label|url" lines after the main endpoint', () => {
  const raw = '线路A|https://a.example.com\n线路B|https://b.example.com'
  const list = parseApiEndpoints(raw, MAIN, 'Main site')
  assert.deepEqual(list, [
    { label: 'Main site', url: MAIN },
    { label: '线路A', url: 'https://a.example.com' },
    { label: '线路B', url: 'https://b.example.com' },
  ])
})

test('line without "|" uses the url as its own label', () => {
  const list = parseApiEndpoints('https://a.example.com', MAIN, 'Main')
  assert.deepEqual(list[1], {
    label: 'https://a.example.com',
    url: 'https://a.example.com',
  })
})

test('trims whitespace, strips trailing slashes, skips blank lines', () => {
  const raw = '  线路A | https://a.example.com/  \n\n   \n'
  const list = parseApiEndpoints(raw, MAIN, 'Main')
  assert.deepEqual(list[1], { label: '线路A', url: 'https://a.example.com' })
  assert.equal(list.length, 2)
})

test('skips non-http(s) lines', () => {
  const raw = 'bad|ftp://x.example.com\nok|https://a.example.com'
  const list = parseApiEndpoints(raw, MAIN, 'Main')
  assert.equal(list.length, 2)
  assert.equal(list[1].url, 'https://a.example.com')
})

test('dedupes a line equal to the main endpoint', () => {
  const raw = `dup|${MAIN}\nok|https://a.example.com`
  const list = parseApiEndpoints(raw, MAIN, 'Main')
  assert.equal(list.length, 2)
  assert.equal(list[1].url, 'https://a.example.com')
})

test('resolveSelectedUrl returns stored url when still present', () => {
  const list: ApiEndpoint[] = [
    { label: 'Main', url: MAIN },
    { label: 'A', url: 'https://a.example.com' },
  ]
  assert.equal(resolveSelectedUrl(list, 'https://a.example.com'), 'https://a.example.com')
})

test('resolveSelectedUrl falls back to main when stored url is gone or null', () => {
  const list: ApiEndpoint[] = [{ label: 'Main', url: MAIN }]
  assert.equal(resolveSelectedUrl(list, 'https://gone.example.com'), MAIN)
  assert.equal(resolveSelectedUrl(list, null), MAIN)
})
