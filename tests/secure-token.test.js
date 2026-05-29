// secureToken / apiKey / defineToken tests.
import { test, describe, runTests, assert } from './test-utils.js'
import { secureToken, apiKey, defineToken, isValid, urlAlphabet } from '../index.js'

const URL_SAFE_RE = /^[A-Za-z0-9_-]+$/

describe('secureToken()', () => {
  test('default size is 48 chars, URL-safe', () => {
    const t = secureToken()
    assert.equal(t.length, 48)
    assert.match(t, URL_SAFE_RE)
    assert.ok(isValid(t, urlAlphabet))
  })

  test('respects custom size', () => {
    assert.equal(secureToken(32).length, 32)
    assert.equal(secureToken(64).length, 64)
    assert.equal(secureToken(96).length, 96)
  })

  test('throws on size below 32 (min)', () => {
    assert.throws(() => secureToken(31))
    assert.throws(() => secureToken(0))
    assert.throws(() => secureToken(-5))
  })

  test('throws on non-integer size', () => {
    assert.throws(() => secureToken(48.5))
    assert.throws(() => secureToken('48'))
  })

  test('returns distinct values across calls', () => {
    const seen = new Set()
    for (let i = 0; i < 2000; i++) seen.add(secureToken())
    assert.equal(seen.size, 2000)
  })

  test('large size works (>MAX_POOL_SIZE chunked fill)', () => {
    const t = secureToken(100000)
    assert.equal(t.length, 100000)
    assert.match(t, URL_SAFE_RE)
  })
})

describe('apiKey()', () => {
  test('default produces "nope_live_<40 chars>"', () => {
    const k = apiKey()
    assert.ok(k.startsWith('nope_live_'))
    assert.equal(k.length, 'nope_live_'.length + 40)
  })

  test('respects custom prefix and size', () => {
    const k = apiKey('sk_live', 40)
    assert.ok(k.startsWith('sk_live_'))
    assert.equal(k.length, 'sk_live_'.length + 40)
  })

  test('throws on empty prefix', () => {
    assert.throws(() => apiKey(''))
  })

  test('throws on prefix with whitespace', () => {
    assert.throws(() => apiKey('has space'))
    assert.throws(() => apiKey('tab\there'))
  })

  test('throws on non-string prefix', () => {
    assert.throws(() => apiKey(null))
    assert.throws(() => apiKey(123))
  })

  test('throws on size below 32', () => {
    assert.throws(() => apiKey('sk', 31))
  })

  test('returns distinct values', () => {
    const seen = new Set()
    for (let i = 0; i < 1000; i++) seen.add(apiKey())
    assert.equal(seen.size, 1000)
  })
})

describe('defineToken()', () => {
  test('returns a generate/is/parse triple', () => {
    const T = defineToken('sess', { size: 48 })
    assert.type(T.generate, 'function')
    assert.type(T.is, 'function')
    assert.type(T.parse, 'function')
  })

  test('generate produces "<prefix>_<size>"', () => {
    const T = defineToken('sess', { size: 48 })
    const t = T.generate()
    assert.ok(t.startsWith('sess_'))
    assert.equal(t.length, 'sess_'.length + 48)
  })

  test('is() recognises own output', () => {
    const T = defineToken('pat', { size: 40 })
    for (let i = 0; i < 50; i++) assert.ok(T.is(T.generate()))
  })

  test('is() rejects wrong prefix', () => {
    const Sess = defineToken('sess', { size: 48 })
    const Api = defineToken('api', { size: 48 })
    assert.notOk(Sess.is(Api.generate()))
  })

  test('is() rejects wrong length body', () => {
    const T = defineToken('sess', { size: 48 })
    assert.notOk(T.is('sess_short'))
    assert.notOk(T.is('sess_' + 'a'.repeat(47)))
    assert.notOk(T.is('sess_' + 'a'.repeat(49)))
  })

  test('is() rejects non-URL-safe body chars', () => {
    const T = defineToken('sess', { size: 48 })
    assert.notOk(T.is('sess_' + '!'.repeat(48)))
  })

  test('parse round-trips on valid input, returns null on invalid', () => {
    const T = defineToken('sess', { size: 48 })
    const t = T.generate()
    const parsed = T.parse(t)
    assert.equal(parsed.prefix, 'sess')
    assert.equal(parsed.token.length, 48)
    assert.equal(T.parse('garbage'), null)
    assert.equal(T.parse('sess_short'), null)
  })

  test('throws on invalid prefix', () => {
    assert.throws(() => defineToken(''))
    assert.throws(() => defineToken('has space'))
    assert.throws(() => defineToken(null))
  })

  test('throws when size < 32', () => {
    assert.throws(() => defineToken('sess', { size: 31 }))
  })

  test('respects custom separator', () => {
    const T = defineToken('sk', { size: 32, separator: '.' })
    const t = T.generate()
    assert.ok(t.startsWith('sk.'))
    assert.ok(T.is(t))
  })
})

export default runTests

import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) runTests()
