// customAlphabet / customRandom tier tests.
// The factory picks a refill strategy by alphabet shape (hex-native, pow-2
// bulk translate, non-pow-2 bulk rejection). These tests pin the external
// contract for a representative alphabet of each tier: exact charset, length,
// near-uniform frequency, and correctness across refill boundaries.
import { test, describe, runTests, assert } from './test-utils.js'
import { customAlphabet, customRandom, alphabets, urlAlphabet, random } from '../index.js'

// Enough IDs to force ≥2 pool refills for every tier (pool ≥ 32768 chars).
const idsAcrossRefills = (gen, size, poolChars) => {
  const count = Math.ceil((poolChars * 2.5) / size)
  const ids = []
  for (let i = 0; i < count; i++) ids.push(gen())
  return ids
}

const checkTier = (name, alphabet, size, poolChars) => {
  test(`${name}: length, charset and ±20% frequency across ≥2 refills`, () => {
    const gen = customAlphabet(alphabet, size)
    const allowed = new Set(alphabet)
    const counts = new Map()
    let total = 0
    for (const id of idsAcrossRefills(gen, size, poolChars)) {
      assert.equal(id.length, size)
      for (const char of id) {
        assert.ok(allowed.has(char), `char '${char}' not in alphabet`)
        counts.set(char, (counts.get(char) || 0) + 1)
        total++
      }
    }
    assert.equal(counts.size, alphabet.length, 'every alphabet char must appear')
    const expected = total / alphabet.length
    for (const [char, n] of counts) {
      assert.between(n, expected * 0.8, expected * 1.2,
        `char '${char}' count ${n} outside ±20% of ${Math.round(expected)}`)
    }
  })
}

describe('customAlphabet tier 1 (native hex)', () => {
  checkTier('hexLower', alphabets.hexLower, 16, 65536)
  checkTier('hexUpper', alphabets.hexUpper, 16, 65536)

  test('hexLower matches strict format regexes', () => {
    const gen = customAlphabet(alphabets.hexLower, 32)
    for (let i = 0; i < 100; i++) assert.match(gen(), /^[0-9a-f]{32}$/)
    const genU = customAlphabet(alphabets.hexUpper, 32)
    for (let i = 0; i < 100; i++) assert.match(genU(), /^[0-9A-F]{32}$/)
  })

  test('hex cold path (size > pool): exact length and charset', () => {
    const gen = customAlphabet(alphabets.hexLower, 16)
    const big = gen(70001)
    assert.equal(big.length, 70001)
    assert.match(big, /^[0-9a-f]+$/)
  })

  test('hex tier: NaN/huge sizes return "" and leave the pool healthy', () => {
    const gen = customAlphabet(alphabets.hexLower, 16)
    assert.equal(gen(NaN), '')
    assert.equal(gen(2 ** 32), '')
    for (let i = 0; i < 50; i++) assert.match(gen(), /^[0-9a-f]{16}$/)
  })
})

describe('customAlphabet tier 2 (power-of-2 bulk translate)', () => {
  checkTier('binary (len 2)', alphabets.binary, 32, 32768)
  checkTier('base32 (len 32)', alphabets.base32, 20, 32768)
  checkTier('urlAlphabet (len 64)', urlAlphabet, 21, 32768)

  test('pow-2 cold path (size > pool): exact length and charset', () => {
    const gen = customAlphabet(alphabets.base32, 20)
    const big = gen(40000)
    assert.equal(big.length, 40000)
    assert.match(big, /^[A-Z2-7]+$/)
  })

  test('pow-2 tier: NaN/huge sizes return "" and leave the pool healthy', () => {
    const gen = customAlphabet(alphabets.base32, 20)
    assert.equal(gen(NaN), '')
    assert.equal(gen(2 ** 32), '')
    for (let i = 0; i < 50; i++) assert.match(gen(), /^[A-Z2-7]{20}$/)
  })
})

describe('customAlphabet tier 3 (non-pow-2 bulk rejection)', () => {
  checkTier('base58 (len 58)', alphabets.base58, 21, 32768)
  checkTier('nolookalikes (len 48)', alphabets.nolookalikes, 12, 32768)
  checkTier('numbers (len 10)', alphabets.numbers, 10, 32768)

  test('tiny worst-case alphabet ABC (256%3=1) stays within ±20%', () => {
    const gen = customAlphabet('ABC', 12)
    const counts = { A: 0, B: 0, C: 0 }
    for (let i = 0; i < 10000; i++) for (const char of gen()) counts[char]++
    const expected = (10000 * 12) / 3
    for (const char of 'ABC') {
      assert.between(counts[char], expected * 0.8, expected * 1.2)
    }
  })

  test('non-pow-2 cold path (size > pool): exact length and charset', () => {
    const gen = customAlphabet(alphabets.base58, 21)
    const big = gen(40000)
    assert.equal(big.length, 40000)
    assert.match(big, /^[1-9A-HJ-NP-Za-km-z]+$/)
  })

  test('non-pow-2 cold path with an ODD size: exact length (no pair-write overrun)', () => {
    const gen = customAlphabet(alphabets.base58, 21)
    const big = gen(40001)
    assert.equal(big.length, 40001)
    assert.match(big, /^[1-9A-HJ-NP-Za-km-z]+$/)
  })

  test('large non-pow-2 alphabet (len 200, byte-wise sub-tier): length, charset, coverage', () => {
    // len in [182, 255] keeps byte-wise rejection (better yield than u16 pairs)
    let big200 = ''
    for (let i = 0; i < 200; i++) big200 += String.fromCharCode(0x21 + i)
    const gen = customAlphabet(big200, 16)
    const seen = new Set()
    for (let i = 0; i < 5000; i++) {
      const id = gen()
      assert.equal(id.length, 16)
      for (const ch of id) seen.add(ch)
    }
    assert.equal(seen.size, 200)
    const cold = gen(40001)
    assert.equal(cold.length, 40001)
  })

  test('rejection tier: NaN/huge sizes return "" and leave the pool healthy', () => {
    const gen = customAlphabet(alphabets.base58, 21)
    assert.equal(gen(NaN), '')
    assert.equal(gen(2 ** 32), '')
    for (let i = 0; i < 50; i++) assert.match(gen(), /^[1-9A-HJ-NP-Za-km-z]{21}$/)
  })
})

describe('customRandom bulk chunking contract', () => {
  test('requests are ≤ 65536 bytes, getRandom is called, output correct (pow-2)', () => {
    const requested = []
    const gen = customRandom(alphabets.hexLower, 16, bytes => {
      requested.push(bytes)
      return random(bytes)
    })
    const seen = new Set()
    for (let i = 0; i < 3000; i++) {
      const id = gen()
      assert.match(id, /^[0-9a-f]{16}$/)
      seen.add(id)
    }
    assert.equal(seen.size, 3000)
    assert.greaterThan(requested.length, 0, 'getRandom must be called')
    for (const bytes of requested) {
      assert.between(bytes, 1, 65536, 'chunk request must stay within webcrypto limits')
    }
  })

  test('requests are ≤ 65536 bytes and rejection stays unbiased (non-pow-2)', () => {
    const requested = []
    const gen = customRandom('ABC', 12, bytes => {
      requested.push(bytes)
      return random(bytes)
    })
    const counts = { A: 0, B: 0, C: 0 }
    for (let i = 0; i < 9000; i++) for (const char of gen()) counts[char]++
    const expected = (9000 * 12) / 3
    for (const char of 'ABC') assert.between(counts[char], expected * 0.85, expected * 1.15)
    for (const bytes of requested) assert.between(bytes, 1, 65536)
  })

  test('cold path (size > pool) still validates short getRandom returns', () => {
    assert.throws(() => {
      const gen = customRandom('abcd', 16, () => new Uint8Array(1))
      gen(40000)
    })
  })
})

export default runTests

// Auto-run when executed directly (e.g. `node tests/custom-alphabet-tiers.test.js`):
// print summary + exit non-zero on failure. No-op when imported by tests/index.js.
import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) runTests()
