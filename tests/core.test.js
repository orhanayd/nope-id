// Core Functions Tests - nopeid, customAlphabet, customRandom, random
import { execFileSync } from 'node:child_process'
import { test, describe, runTests, assert } from './test-utils.js'
import {
  nopeid,
  customAlphabet,
  customRandom,
  random,
  urlAlphabet,
  alphabets,
} from '../index.js'

describe('nopeid()', () => {
  test('generates 21 character ID by default', () => {
    const id = nopeid()
    assert.equal(id.length, 21)
  })

  test('generates custom length ID', () => {
    assert.equal(nopeid(10).length, 10)
    assert.equal(nopeid(5).length, 5)
    assert.equal(nopeid(50).length, 50)
    assert.equal(nopeid(100).length, 100)
  })

  test('returns string type', () => {
    assert.equal(typeof nopeid(), 'string')
    assert.equal(typeof nopeid(10), 'string')
  })

  test('generates URL-safe characters only', () => {
    for (let i = 0; i < 100; i++) {
      const id = nopeid()
      assert.match(id, /^[A-Za-z0-9_-]+$/)
    }
  })

  test('generates unique IDs', () => {
    const ids = new Set()
    for (let i = 0; i < 10000; i++) {
      ids.add(nopeid())
    }
    assert.equal(ids.size, 10000)
  })

  test('handles edge cases', () => {
    assert.equal(nopeid(1).length, 1)
    assert.equal(nopeid(0).length, 0)
    assert.equal(nopeid(0), '')
  })

  test('returns empty string for negative size', () => {
    assert.equal(nopeid(-1), '')
    assert.equal(nopeid(-100), '')
  })

  test('handles very large sizes', () => {
    const largeId = nopeid(1000)
    assert.equal(largeId.length, 1000)
    assert.match(largeId, /^[A-Za-z0-9_-]+$/)
  })

  test('uses all characters from urlAlphabet', () => {
    const usedChars = new Set()
    // Generate enough IDs to likely use all characters
    for (let i = 0; i < 10000; i++) {
      const id = nopeid()
      for (const char of id) {
        usedChars.add(char)
      }
    }
    // Should use most of the 64 characters
    assert.ok(usedChars.size >= 60, `Used ${usedChars.size} characters, expected at least 60`)
  })
})

describe('customAlphabet()', () => {
  test('creates generator with custom alphabet', () => {
    const hexId = customAlphabet('0123456789abcdef', 16)
    const id = hexId()
    assert.equal(id.length, 16)
    assert.match(id, /^[0-9a-f]+$/)
  })

  test('respects default size', () => {
    const gen = customAlphabet('abc', 10)
    assert.equal(gen().length, 10)
  })

  test('allows size override', () => {
    const gen = customAlphabet('abc', 10)
    assert.equal(gen(5).length, 5)
    assert.equal(gen(20).length, 20)
  })

  test('works with numbers only', () => {
    const numericId = customAlphabet('0123456789', 8)
    const id = numericId()
    assert.match(id, /^\d{8}$/)
  })

  test('works with uppercase only', () => {
    const upperGen = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)
    const id = upperGen()
    assert.match(id, /^[A-Z]{6}$/)
  })

  test('works with lowercase only', () => {
    const lowerGen = customAlphabet('abcdefghijklmnopqrstuvwxyz', 6)
    const id = lowerGen()
    assert.match(id, /^[a-z]{6}$/)
  })

  test('works with binary alphabet', () => {
    const binaryGen = customAlphabet('01', 16)
    const id = binaryGen()
    assert.match(id, /^[01]{16}$/)
  })

  test('generates unique IDs', () => {
    const gen = customAlphabet(alphabets.alphanumeric, 21)
    const ids = new Set()
    for (let i = 0; i < 1000; i++) {
      ids.add(gen())
    }
    assert.equal(ids.size, 1000)
  })

  test('works with pre-built alphabets', () => {
    const hexGen = customAlphabet(alphabets.hexLower, 32)
    assert.match(hexGen(), /^[0-9a-f]{32}$/)

    const hexUpperGen = customAlphabet(alphabets.hexUpper, 32)
    assert.match(hexUpperGen(), /^[0-9A-F]{32}$/)
  })

  test('throws error for empty alphabet', () => {
    assert.throws(() => customAlphabet(''))
    assert.throws(() => customAlphabet(null))
    assert.throws(() => customAlphabet(undefined))
  })

  test('throws error for alphabet longer than 256 characters', () => {
    const longAlphabet = 'a'.repeat(257)
    assert.throws(() => customAlphabet(longAlphabet))
  })

  test('returns empty string for zero/negative size', () => {
    const gen = customAlphabet('abc', 10)
    assert.equal(gen(0), '')
    assert.equal(gen(-5), '')
  })

  test('works with single character alphabet', () => {
    const gen = customAlphabet('x', 5)
    assert.equal(gen(), 'xxxxx')
  })

  test('works with 256 character alphabet (max)', () => {
    let alphabet = ''
    for (let i = 0; i < 256; i++) {
      alphabet += String.fromCharCode(i)
    }
    const gen = customAlphabet(alphabet, 10)
    assert.equal(gen().length, 10)
  })
})

describe('customRandom()', () => {
  test('uses custom random function', () => {
    let callCount = 0
    const customRandomFn = size => {
      callCount++
      const arr = new Uint8Array(size)
      for (let i = 0; i < size; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    }

    const gen = customRandom('abc', 10, customRandomFn)
    const id = gen()

    assert.equal(id.length, 10)
    assert.match(id, /^[abc]+$/)
    assert.ok(callCount > 0, 'Custom random function should be called')
  })

  test('respects size parameter', () => {
    const mockRandom = size => new Uint8Array(size).fill(0)
    const gen = customRandom('abcd', 15, mockRandom)
    assert.equal(gen().length, 15)
    assert.equal(gen(8).length, 8)
  })

  test('works with deterministic random', () => {
    // Use a "random" that always returns same values
    let counter = 0
    const deterministicRandom = size => {
      const arr = new Uint8Array(size)
      for (let i = 0; i < size; i++) {
        arr[i] = (counter++ * 7) % 256
      }
      return arr
    }

    const gen = customRandom('0123456789', 10, deterministicRandom)
    const id = gen()
    assert.equal(id.length, 10)
    assert.match(id, /^\d{10}$/)
  })

  test('throws error for empty alphabet', () => {
    const mockRandom = size => new Uint8Array(size)
    assert.throws(() => customRandom('', 10, mockRandom))
    assert.throws(() => customRandom(null, 10, mockRandom))
  })

  test('returns empty string for zero/negative size', () => {
    const mockRandom = size => new Uint8Array(size)
    const gen = customRandom('abc', 10, mockRandom)
    assert.equal(gen(0), '')
    assert.equal(gen(-5), '')
  })
})

describe('random()', () => {
  test('returns Uint8Array or Buffer with correct length', () => {
    const bytes = random(16)
    assert.equal(bytes.length, 16)
  })

  test('returns different values', () => {
    const bytes1 = random(32)
    const bytes2 = random(32)
    // Very unlikely to be equal
    let different = false
    for (let i = 0; i < 32; i++) {
      if (bytes1[i] !== bytes2[i]) {
        different = true
        break
      }
    }
    assert.ok(different, 'Random bytes should differ')
  })

  test('handles various sizes', () => {
    assert.equal(random(1).length, 1)
    assert.equal(random(8).length, 8)
    assert.equal(random(64).length, 64)
    assert.equal(random(256).length, 256)
  })

  test('returns empty buffer for zero bytes', () => {
    const bytes = random(0)
    assert.equal(bytes.length, 0)
  })

  test('returns empty buffer for negative bytes', () => {
    const bytes = random(-10)
    assert.equal(bytes.length, 0)
  })

  test('bytes are within valid range (0-255)', () => {
    const bytes = random(1000)
    for (let i = 0; i < bytes.length; i++) {
      assert.ok(bytes[i] >= 0 && bytes[i] <= 255)
    }
  })
})

describe('urlAlphabet', () => {
  test('has 64 characters', () => {
    assert.equal(urlAlphabet.length, 64)
  })

  test('contains only URL-safe characters', () => {
    assert.match(urlAlphabet, /^[A-Za-z0-9_-]+$/)
  })

  test('has no duplicate characters', () => {
    const chars = new Set(urlAlphabet)
    assert.equal(chars.size, urlAlphabet.length)
  })
})

describe('alphabets', () => {
  test('alphanumeric has 62 characters', () => {
    assert.equal(alphabets.alphanumeric.length, 62)
    assert.match(alphabets.alphanumeric, /^[A-Za-z0-9]+$/)
  })

  test('lowercase has 26 characters', () => {
    assert.equal(alphabets.lowercase.length, 26)
    assert.match(alphabets.lowercase, /^[a-z]+$/)
  })

  test('uppercase has 26 characters', () => {
    assert.equal(alphabets.uppercase.length, 26)
    assert.match(alphabets.uppercase, /^[A-Z]+$/)
  })

  test('numbers has 10 characters', () => {
    assert.equal(alphabets.numbers.length, 10)
    assert.match(alphabets.numbers, /^[0-9]+$/)
  })

  test('hexLower has 16 characters', () => {
    assert.equal(alphabets.hexLower.length, 16)
    assert.match(alphabets.hexLower, /^[0-9a-f]+$/)
  })

  test('hexUpper has 16 characters', () => {
    assert.equal(alphabets.hexUpper.length, 16)
    assert.match(alphabets.hexUpper, /^[0-9A-F]+$/)
  })

  test('binary has 2 characters', () => {
    assert.equal(alphabets.binary.length, 2)
    assert.equal(alphabets.binary, '01')
  })

  test('octal has 8 characters', () => {
    assert.equal(alphabets.octal.length, 8)
    assert.match(alphabets.octal, /^[0-7]+$/)
  })

  test('nolookalikes excludes confusing characters', () => {
    // Should not contain: 0, O, 1, l, I
    assert.ok(!alphabets.nolookalikes.includes('0'))
    assert.ok(!alphabets.nolookalikes.includes('O'))
    assert.ok(!alphabets.nolookalikes.includes('1'))
    assert.ok(!alphabets.nolookalikes.includes('l'))
    assert.ok(!alphabets.nolookalikes.includes('I'))
  })

  test('filename has 64 characters', () => {
    assert.equal(alphabets.filename.length, 64)
    assert.match(alphabets.filename, /^[A-Za-z0-9_-]+$/)
  })

  test('all alphabets have no duplicates', () => {
    for (const [name, alphabet] of Object.entries(alphabets)) {
      const chars = new Set(alphabet)
      assert.equal(chars.size, alphabet.length, `${name} has duplicate characters`)
    }
  })
})

// === ADDITIONAL EDGE CASE TESTS ===

describe('nopeid() edge cases', () => {
  test('handles float size by truncating', () => {
    const id = nopeid(10.7)
    assert.equal(id.length, 10)
  })

  test('handles string number size', () => {
    // JavaScript coerces to number via |= 0
    const id = nopeid('15')
    assert.ok(id.length > 0)
  })

  test('pool refills correctly after many generations', () => {
    // The pool holds 65536 chars (~3120 IDs of 21 chars), so 10000 IDs cross
    // at least three refills wherever the pool offset starts
    const ids = new Set()
    for (let i = 0; i < 10000; i++) {
      ids.add(nopeid(21))
    }
    assert.equal(ids.size, 10000, 'All IDs should be unique after pool refills')
  })

  test('generates different IDs in rapid succession', () => {
    const ids = []
    for (let i = 0; i < 1000; i++) {
      ids.push(nopeid())
    }
    const unique = new Set(ids)
    assert.equal(unique.size, 1000, 'Rapid generation should produce unique IDs')
  })
})

describe('random() edge cases', () => {
  test('pool expansion for larger requests', () => {
    // First request small
    const small = random(10)
    assert.equal(small.length, 10)

    // Then a much larger one: the shared pool grows as needed (up to 64 KiB)
    const large = random(1000)
    assert.equal(large.length, 1000)

    // Verify bytes are valid
    for (let i = 0; i < large.length; i++) {
      assert.ok(large[i] >= 0 && large[i] <= 255)
    }
  })

  test('requests above the 64 KiB pool are one-shot and never grow the shared pool', () => {
    // Growing the shared pool for these would keep the largest request alive for
    // the process lifetime (200 MB after random(200e6)). A child process with
    // --expose-gc measures what stays allocated after the big requests.
    const builds = ['index.js', 'index.cjs', 'index.browser.js']
      .map(f => new URL(`../${f}`, import.meta.url).href)
    const script = `
      for (const url of ${JSON.stringify(builds)}) {
        const m = await import(url)
        if (m.random(32 * 1024 * 1024).length !== 32 * 1024 * 1024) throw new Error('random length')
        if (m.sortableId(100000).length !== 100000) throw new Error('sortableId length')
      }
      gc()
      process.stdout.write(String(process.memoryUsage().arrayBuffers))`
    const retained = Number(execFileSync(process.execPath,
      ['--expose-gc', '--input-type=module', '-e', script], { encoding: 'utf8' }))
    assert.ok(retained < 8 * 1024 * 1024, `pools retained ${retained} bytes after large requests`)
  })
})

describe('customAlphabet() edge cases', () => {
  test('works with 2-char alphabet (binary)', () => {
    const binaryGen = customAlphabet('01', 32)
    const id = binaryGen()
    assert.equal(id.length, 32)
    assert.match(id, /^[01]+$/)
  })

  test('handles alphabet with special regex chars', () => {
    const gen = customAlphabet('[]{}()*+?.\\^$|', 10)
    const id = gen()
    assert.equal(id.length, 10)
  })

  test('uniform distribution across alphabet', () => {
    const alphabet = 'ABCD'
    const gen = customAlphabet(alphabet, 1)
    const counts = { A: 0, B: 0, C: 0, D: 0 }

    for (let i = 0; i < 10000; i++) {
      counts[gen()]++
    }

    // Each should be roughly 25% (2500), allow 15% variance
    for (const char of alphabet) {
      assert.ok(counts[char] > 1500, `${char} count too low: ${counts[char]}`)
      assert.ok(counts[char] < 3500, `${char} count too high: ${counts[char]}`)
    }
  })

  test('size is coerced to an int32 like nopeid (NaN, strings, floats, huge)', () => {
    const gen = customAlphabet('abcdefgh', 16)
    assert.equal(gen(NaN), '')
    assert.equal(gen('8').length, 8)
    assert.equal(gen(1.9).length, 1)
    assert.equal(gen(2 ** 32), '') // |0 wraps to 0 instead of reaching the CSPRNG
    assert.equal(gen(true).length, 1)
  })

  test('edge-case sizes do not poison the pool (NaN/string offsets)', () => {
    const gen = customAlphabet('abcdefgh', 16)
    gen(NaN)
    for (let i = 0; i < 100; i++) {
      assert.equal(gen(21).length, 21, `call ${i} after NaN must stay 21 chars`)
    }
    gen('8')
    assert.equal(gen(16).length, 16, 'call after string size must stay 16 chars')
  })

  test('non-string alphabets throw a clear error', () => {
    // Without the type check a number reaches the tiers (internal RangeError; the browser build hangs)
    for (const alphabet of [12345, ['a', 'b', 'c'], { length: 3 }, true]) {
      assert.throws(() => customAlphabet(alphabet), /Alphabet must be a string/)
      assert.throws(() => customRandom(alphabet, 5, random), /Alphabet must be a string/)
    }
    for (const alphabet of ['', null, undefined]) {
      assert.throws(() => customAlphabet(alphabet), /Alphabet cannot be empty/)
    }
  })
})

describe('customRandom() edge cases', () => {
  test('works with custom deterministic random', () => {
    let counter = 0
    const deterministicRandom = size => {
      const bytes = new Uint8Array(size)
      for (let i = 0; i < size; i++) {
        bytes[i] = counter++ % 256
      }
      return bytes
    }

    const gen = customRandom('ABCD', 10, deterministicRandom)
    const id1 = gen()
    const id2 = gen()

    assert.equal(id1.length, 10)
    assert.equal(id2.length, 10)
    // With deterministic random, IDs should be predictable (but different due to counter)
    assert.notEqual(id1, id2)
  })

  test('size is coerced and edge cases do not poison the pool', () => {
    const gen = customRandom('abcdef', 10, size => random(size))
    assert.equal(gen(NaN), '')
    assert.equal(gen().length, 10)
    assert.equal(gen('8').length, 8)
    assert.equal(gen(16).length, 16, 'call after string size must stay 16 chars')
    assert.equal(gen(-3), '')
    assert.equal(gen().length, 10)
  })

  test('a getRandom that never yields an acceptable byte throws instead of hanging', () => {
    // 255 is the one byte a 3-char alphabet rejects (cutoff 255): a constant 255
    // would make the refill loop forever without the stuck-generator check
    const stuck = size => new Uint8Array(size).fill(255)
    const gen = customRandom('abc', 5, stuck)
    assert.throws(() => gen(), /getRandom returned no bytes usable for this alphabet/)
    assert.throws(() => gen(40000), /getRandom returned no bytes usable for this alphabet/)
    // A constant but acceptable byte is still a (degenerate) generator, not an error
    assert.equal(customRandom('abc', 5, size => new Uint8Array(size).fill(1))(), 'bbbbb')
  })
})

// === SECURITY & ENTROPY TESTS ===

describe('Security: Entropy Quality', () => {
  test('random bytes have good entropy distribution', () => {
    // Collect multiple smaller samples to test distribution
    // (single call is limited by pool size considerations)
    const freq = new Array(256).fill(0)
    const samplesNeeded = 10000
    let totalBytes = 0

    // Collect bytes in chunks that won't exceed pool limits
    while (totalBytes < samplesNeeded) {
      const chunkSize = Math.min(256, samplesNeeded - totalBytes)
      const bytes = random(chunkSize)
      for (let i = 0; i < bytes.length; i++) {
        freq[bytes[i]]++
      }
      totalBytes += chunkSize
    }

    // Expected frequency per byte value
    const expected = totalBytes / 256
    const tolerance = expected * 0.5 // Allow 50% variance

    let outliers = 0
    for (let i = 0; i < 256; i++) {
      if (Math.abs(freq[i] - expected) > tolerance) {
        outliers++
      }
    }

    // Less than 5% of byte values should be outliers
    assert.ok(outliers < 13, `Too many outliers in byte distribution: ${outliers}`)
  })

  test('generated IDs have good character distribution', () => {
    const charFreq = {}
    const sampleSize = 10000

    for (let i = 0; i < sampleSize; i++) {
      const id = nopeid(21)
      for (const char of id) {
        charFreq[char] = (charFreq[char] || 0) + 1
      }
    }

    const totalChars = sampleSize * 21
    const expectedPerChar = totalChars / 64 // 64 char alphabet
    const tolerance = expectedPerChar * 0.3 // Allow 30% variance

    let outliers = 0
    for (const char of urlAlphabet) {
      const count = charFreq[char] || 0
      if (Math.abs(count - expectedPerChar) > tolerance) {
        outliers++
      }
    }

    // Less than 10% of characters should be outliers
    assert.ok(outliers < 7, `Character distribution not uniform: ${outliers} outliers`)
  })

  test('no predictable patterns in sequential IDs', () => {
    const ids = []
    for (let i = 0; i < 100; i++) {
      ids.push(nopeid())
    }

    // Check no two consecutive IDs share more than 50% characters in same position
    for (let i = 1; i < ids.length; i++) {
      let samePos = 0
      for (let j = 0; j < 21; j++) {
        if (ids[i][j] === ids[i-1][j]) samePos++
      }
      assert.ok(samePos < 11, `Sequential IDs too similar: ${samePos}/21 same positions`)
    }
  })

  test('chi-square test for randomness', () => {
    const observed = new Array(64).fill(0)
    const sampleSize = 6400 // 100 IDs * 64 chars each for nice numbers

    for (let i = 0; i < 100; i++) {
      const id = nopeid(64)
      for (const char of id) {
        const idx = urlAlphabet.indexOf(char)
        observed[idx]++
      }
    }

    const expected = sampleSize / 64
    let chiSquare = 0
    for (let i = 0; i < 64; i++) {
      chiSquare += Math.pow(observed[i] - expected, 2) / expected
    }

    // Chi-square critical value for 63 df at 0.01 significance is ~92
    // At 0.05 it's ~82. We use a generous threshold.
    assert.ok(chiSquare < 120, `Chi-square too high: ${chiSquare.toFixed(2)}`)
  })
})

// === BOUNDARY & STRESS TESTS ===

describe('Boundary Tests', () => {
  test('handles size = 1 correctly', () => {
    for (let i = 0; i < 100; i++) {
      const id = nopeid(1)
      assert.equal(id.length, 1)
      assert.ok(urlAlphabet.includes(id))
    }
  })

  test('handles maximum practical size', () => {
    const id = nopeid(10000)
    assert.equal(id.length, 10000)
    for (const char of id) {
      assert.ok(urlAlphabet.includes(char))
    }
  })

  test('cold path (size > pool) with non-multiple-of-4 size: exact length, charset, distribution', () => {
    // 100001 chars forces the >MAX_POOL_SIZE cold path AND a trailing partial
    // encode group boundary. Every char must come from a full 3-byte group:
    // a padding/partial-group bug would skew the tail chars' distribution.
    const id = nopeid(100001)
    assert.equal(id.length, 100001)
    assert.notOk(id.includes('='), 'base64url output must never contain padding')
    const counts = new Map()
    for (const char of id) {
      assert.ok(urlAlphabet.includes(char), `Unexpected char: ${char}`)
      counts.set(char, (counts.get(char) || 0) + 1)
    }
    assert.equal(counts.size, 64, 'cold path must use all 64 alphabet chars')
    // ~1562 expected per char; ±30% tolerance mirrors the pooled-path gate
    const expected = 100001 / 64
    let outliers = 0
    for (const n of counts.values()) {
      if (Math.abs(n - expected) > expected * 0.3) outliers++
    }
    assert.lessThan(outliers, 4, 'cold path char distribution must stay uniform')
  })

  test('handles size = 0', () => {
    assert.equal(nopeid(0), '')
  })

  test('handles negative sizes', () => {
    assert.equal(nopeid(-1), '')
    assert.equal(nopeid(-100), '')
    assert.equal(nopeid(-Infinity), '')
  })

  test('handles NaN size', () => {
    const id = nopeid(NaN)
    assert.equal(id, '')
  })

  test('handles Infinity size gracefully', () => {
    // Should not hang - Infinity |= 0 becomes 0
    const id = nopeid(Infinity)
    assert.equal(id, '')
  })
})

describe('Stress Tests', () => {
  test('rapid sequential generation (10000 IDs)', () => {
    const ids = new Set()
    for (let i = 0; i < 10000; i++) {
      ids.add(nopeid())
    }
    assert.equal(ids.size, 10000, 'All 10000 rapid IDs should be unique')
  })

  test('pool exhaustion and refill cycle', () => {
    // 65536-char pool, ~3120 IDs of 21 chars: 10000 IDs exhaust it at least three times
    const ids = new Set()
    for (let i = 0; i < 10000; i++) {
      ids.add(nopeid(21))
    }
    assert.equal(ids.size, 10000, 'All IDs unique across pool refills')
  })

  test('varying sizes in sequence', () => {
    const ids = []
    for (let i = 1; i <= 100; i++) {
      ids.push(nopeid(i))
    }

    for (let i = 0; i < 100; i++) {
      assert.equal(ids[i].length, i + 1)
    }
  })

  test('alternating between different generators', () => {
    const results = []
    for (let i = 0; i < 100; i++) {
      results.push(nopeid())
      results.push(customAlphabet('abc', 10)())
      results.push(random(16))
    }
    assert.equal(results.length, 300)
  })
})

// === TYPE COERCION TESTS ===

describe('Type Coercion Edge Cases', () => {
  test('string number size', () => {
    const id = nopeid('21')
    assert.ok(id.length > 0)
  })

  test('boolean size', () => {
    const idTrue = nopeid(true) // true |= 0 => 1
    const idFalse = nopeid(false) // false |= 0 => 0
    assert.equal(idTrue.length, 1)
    assert.equal(idFalse.length, 0)
  })

  test('null size', () => {
    const id = nopeid(null) // null |= 0 => 0
    assert.equal(id, '')
  })

  test('undefined uses default', () => {
    const id = nopeid(undefined)
    assert.equal(id.length, 21)
  })

  test('object size', () => {
    const id = nopeid({}) // {} |= 0 => 0
    assert.equal(id, '')
  })

  test('array size', () => {
    const id1 = nopeid([10]) // [10] |= 0 => 10
    const id2 = nopeid([]) // [] |= 0 => 0
    assert.equal(id1.length, 10)
    assert.equal(id2.length, 0)
  })
})

// === CROSS-MODULE CONSISTENCY TESTS ===

describe('Cross-Module Consistency', () => {
  test('urlAlphabet matches expected', () => {
    assert.equal(urlAlphabet.length, 64)
    assert.equal(urlAlphabet, 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict')
  })

  test('all alphabet characters are ASCII printable', () => {
    for (const char of urlAlphabet) {
      const code = char.charCodeAt(0)
      assert.ok(code >= 32 && code <= 126, `Non-printable char: ${code}`)
    }
  })

  test('random returns Buffer/Uint8Array with correct length', () => {
    const sizes = [0, 1, 16, 100, 1000]
    for (const size of sizes) {
      const bytes = random(size)
      assert.equal(bytes.length, size)
    }
  })

  test('customAlphabet respects alphabet constraint', () => {
    const alpha = 'XYZ'
    const gen = customAlphabet(alpha, 100)
    const id = gen()

    for (const char of id) {
      assert.ok(alpha.includes(char), `Unexpected char: ${char}`)
    }
  })
})

export default runTests

// Auto-run when executed directly (e.g. `node tests/core.test.js`): print summary +
// exit non-zero on failure. No-op when imported by tests/index.js (that file is argv[1]).
import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) runTests()
