// Browser bundle smoke test.
// Imports ../index.browser.js (Web Crypto API path) and exercises the public surface.
// Node 18+ ships both `crypto` (Web Crypto API) and `TextDecoder` as globals, so we
// can run the browser bundle directly under Node without jsdom or a real browser.
//
// Run with: npm run test:browser

import { describe, test, assert, runTests } from './test-utils.js'
import {
  nopeid,
  customAlphabet,
  random,
  prefixedId,
  sortableId,
  decodeTime,
  uuid,
  slugId,
  shortId,
  generateMany,
  isValid,
  urlAlphabet,
  alphabets,
} from '../index.browser.js'

describe('Browser bundle: nopeid()', () => {
  test('default size is 21', () => {
    assert.equal(nopeid().length, 21)
  })

  test('respects custom size', () => {
    assert.equal(nopeid(10).length, 10)
    assert.equal(nopeid(64).length, 64)
  })

  test('returns empty string for size <= 0', () => {
    assert.equal(nopeid(0), '')
    assert.equal(nopeid(-5), '')
  })

  test('handles cold path (size > pool)', () => {
    const big = nopeid(100000)
    assert.equal(big.length, 100000)
    assert.ok([...big].every(c => urlAlphabet.includes(c)), 'all chars in url alphabet')
  })

  test('only emits URL-safe characters', () => {
    const id = nopeid()
    assert.ok([...id].every(c => urlAlphabet.includes(c)))
  })

  test('10,000 sequential IDs are all unique', () => {
    const set = new Set()
    for (let i = 0; i < 10000; i++) set.add(nopeid())
    assert.equal(set.size, 10000)
  })
})

describe('Browser bundle: customAlphabet()', () => {
  test('respects custom alphabet and size', () => {
    const hex = customAlphabet('0123456789abcdef', 16)
    const id = hex()
    assert.equal(id.length, 16)
    assert.match(id, /^[0-9a-f]{16}$/)
  })

  test('throws on empty alphabet', () => {
    assert.throws(() => customAlphabet('', 10))
  })
})

describe('Browser bundle: random()', () => {
  test('returns a Uint8Array of the requested length', () => {
    const b = random(32)
    assert.instanceOf(b, Uint8Array)
    assert.equal(b.length, 32)
  })

  test('returns empty Uint8Array for non-positive request', () => {
    assert.equal(random(0).length, 0)
    assert.equal(random(-1).length, 0)
  })
})

describe('Browser bundle: features', () => {
  test('prefixedId composes correctly', () => {
    const id = prefixedId('user')
    assert.ok(id.startsWith('user_'))
    assert.equal(id.length, 'user_'.length + 21)
  })

  test('sortableId is 22 chars by default and round-trips through decodeTime', () => {
    const id = sortableId()
    assert.equal(id.length, 22)
    const date = decodeTime(id)
    assert.instanceOf(date, Date)
    assert.between(Math.abs(date.getTime() - Date.now()), 0, 5000)
  })

  test('uuid() matches v4 shape', () => {
    assert.match(uuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  test('slugId and shortId produce strings of the expected length', () => {
    assert.equal(slugId().length, 12)
    assert.equal(shortId().length, 8)
  })

  test('generateMany returns N unique ids', () => {
    const arr = generateMany(50)
    assert.equal(arr.length, 50)
    assert.equal(new Set(arr).size, 50)
  })

  test('isValid accepts a generated id', () => {
    assert.ok(isValid(nopeid()))
  })
})

describe('Browser bundle: alphabets', () => {
  test('exposes the same pre-built alphabets', () => {
    assert.equal(alphabets.hexLower, '0123456789abcdef')
    assert.equal(alphabets.binary, '01')
    assert.equal(alphabets.alphanumeric.length, 62)
  })
})

runTests()
