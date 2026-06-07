import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseSensitiveWordGroups,
  serializeSensitiveWordGroups,
  parseTxtWords,
  LEGACY_GROUP_NAME,
  type SensitiveWordGroup,
} from './sensitive-word-groups'

test('parses JSON group format', () => {
  const groups = parseSensitiveWordGroups(
    '[{"name":"暴恐词库","enabled":true,"words":[" a ","","b"]}]'
  )
  assert.equal(groups.length, 1)
  assert.equal(groups[0].name, '暴恐词库')
  assert.equal(groups[0].enabled, true)
  assert.deepEqual(groups[0].words, ['a', 'b'])
})

test('parses legacy newline format into default group', () => {
  const groups = parseSensitiveWordGroups('w1\n w2 \n\nw3')
  assert.equal(groups.length, 1)
  assert.equal(groups[0].name, LEGACY_GROUP_NAME)
  assert.equal(groups[0].enabled, true)
  assert.deepEqual(groups[0].words, ['w1', 'w2', 'w3'])
})

test('empty value yields no groups', () => {
  assert.deepEqual(parseSensitiveWordGroups(''), [])
  assert.deepEqual(parseSensitiveWordGroups('  \n '), [])
})

test('invalid JSON starting with bracket falls back to legacy', () => {
  const groups = parseSensitiveWordGroups('[broken\nw2')
  assert.equal(groups.length, 1)
  assert.equal(groups[0].name, LEGACY_GROUP_NAME)
  assert.deepEqual(groups[0].words, ['[broken', 'w2'])
})

test('JSON array of strings (not groups) falls back to legacy', () => {
  const groups = parseSensitiveWordGroups('["a","b"]')
  assert.equal(groups.length, 1)
  assert.equal(groups[0].name, LEGACY_GROUP_NAME)
})

test('serialize round-trips through parse', () => {
  const input: SensitiveWordGroup[] = [
    { name: 'A', enabled: true, words: ['x', 'y'] },
    { name: 'B', enabled: false, words: [] },
  ]
  const parsed = parseSensitiveWordGroups(serializeSensitiveWordGroups(input))
  assert.deepEqual(parsed, input)
})

test('serialize trims and drops empty words', () => {
  const out = serializeSensitiveWordGroups([
    { name: 'A', enabled: true, words: [' x ', '', 'y'] },
  ])
  assert.deepEqual(JSON.parse(out)[0].words, ['x', 'y'])
})

test('parseTxtWords handles CRLF, trims, drops empties', () => {
  assert.deepEqual(parseTxtWords('a\r\n b \n\nc\n'), ['a', 'b', 'c'])
})
