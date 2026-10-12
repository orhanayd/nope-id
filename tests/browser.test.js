// Browser bundle smoke test.
// Imports ../index.browser.js (Web Crypto API path) and exercises the public surface.
// Node 18+ ships both `crypto` (Web Crypto API) and `TextDecoder` as globals, so we
// can run the browser bundle directly under Node without jsdom or a real browser.
//
// Run with: npm run test:browser

import { execFileSync } from 'node:child_process'
import { describe, test, assert, runTests } from './test-utils.js'
import {
  nopeid,
  customAlphabet,
  customRandom,
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

  test('Latin-1 alphabets with U+0080-U+009F stay exact (TextDecoder latin1 is windows-1252)', () => {
    // windows-1252 decodes 0x80 as '€' (U+20AC): a 'latin1' decoder would remap these chars
    const alphabet = Array.from({ length: 40 }, (_, i) => String.fromCharCode(0x80 + i)).join('')
    const pow2 = alphabet.slice(0, 32)
    for (const [chars, gen] of [
      [alphabet, customAlphabet(alphabet, 64)],
      [pow2, customAlphabet(pow2, 64)],
      [alphabet, customRandom(alphabet, 64, size => crypto.getRandomValues(new Uint8Array(size)))],
    ]) {
      for (const id of [gen(), gen(40000)]) {
        assert.ok([...id].every(c => chars.includes(c)), 'every char must come from the alphabet')
        assert.ok(isValid(id, chars))
      }
    }
  })
})

describe('Browser bundle: ES2026 native encoders (toBase64 / toHex)', () => {
  test('nopeid and hex/base64-set customAlphabet use them, with correct uniform output', () => {
    // Node 22 has no Uint8Array.prototype.toBase64/toHex, so a child process
    // polyfills them with Buffer BEFORE the bundle loads (feature detection runs
    // at import) and counts calls to prove the native paths are really taken.
    const url = new URL('../index.browser.js', import.meta.url).href
    const script = `
      let calls = 0
      Uint8Array.prototype.toBase64 = function (opts = {}) {
        calls++
        const s = Buffer.from(this.buffer, this.byteOffset, this.length)
          .toString(opts.alphabet === 'base64url' ? 'base64url' : 'base64')
        return opts.omitPadding ? s.replace(/=+$/, '') : s
      }
      Uint8Array.prototype.toHex = function () {
        calls++
        return Buffer.from(this.buffer, this.byteOffset, this.length).toString('hex')
      }
      const b = await import(${JSON.stringify(url)})
      const base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      const out = {}
      for (const [name, alphabet, gen] of [
        ['nopeid', b.urlAlphabet, n => b.nopeid(n)],
        ['hexLower', b.alphabets.hexLower, b.customAlphabet(b.alphabets.hexLower, 21)],
        ['hexUpper', b.alphabets.hexUpper, b.customAlphabet(b.alphabets.hexUpper, 21)],
        ['filename', b.alphabets.filename, b.customAlphabet(b.alphabets.filename, 21)],
        ['base64', base64, b.customAlphabet(base64, 21)],
      ]) {
        const before = calls
        let s = ''
        for (let i = 0; i < 4000; i++) s += gen(21)
        s += gen(70000) // cold path
        const counts = new Map()
        for (const ch of s) counts.set(ch, (counts.get(ch) || 0) + 1)
        const expected = s.length / alphabet.length
        let chi = 0
        for (const ch of alphabet) chi += ((counts.get(ch) || 0) - expected) ** 2 / expected
        out[name] = { native: calls > before, foreign: [...counts.keys()].filter(c => !alphabet.includes(c)).length,
          z: (chi - (alphabet.length - 1)) / Math.sqrt(2 * (alphabet.length - 1)) }
      }
      process.stdout.write(JSON.stringify(out))`
    const results = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }))
    for (const [name, r] of Object.entries(results)) {
      assert.ok(r.native, `${name} must use the native encoder`)
      assert.equal(r.foreign, 0, `${name} emitted chars outside its alphabet`)
      assert.between(r.z, -6, 6, `${name} distribution`)
    }
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
