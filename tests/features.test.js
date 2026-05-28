// Extra Features Tests - prefixedId, sortableId, generateMany, slugId, shortId
import { test, describe, runTests, assert } from './test-utils.js'
import {
  prefixedId,
  sortableId,
  generateMany,
  slugId,
  shortId,
  nopeidAsync,
  decodeTime,
  getFingerprint,
  distributedId,
  isValid,
  uuid,
} from '../index.js'

describe('prefixedId()', () => {
  test('generates ID with prefix', () => {
    const id = prefixedId('user')
    assert.ok(id.startsWith('user_'))
  })

  test('uses default separator (_)', () => {
    const id = prefixedId('test')
    assert.match(id, /^test_/)
  })

  test('uses custom separator', () => {
    const id = prefixedId('order', 21, '-')
    assert.ok(id.startsWith('order-'))
  })

  test('respects size parameter', () => {
    const id = prefixedId('user', 10)
    // prefix (4) + separator (1) + random (10) = 15
    assert.equal(id.length, 15)
  })

  test('generates unique IDs with same prefix', () => {
    const ids = new Set()
    for (let i = 0; i < 1000; i++) {
      ids.add(prefixedId('user'))
    }
    assert.equal(ids.size, 1000)
  })

  test('works with various prefixes', () => {
    assert.ok(prefixedId('a').startsWith('a_'))
    assert.ok(prefixedId('order').startsWith('order_'))
    assert.ok(prefixedId('transaction').startsWith('transaction_'))
    assert.ok(prefixedId('usr', 10, ':').startsWith('usr:'))
  })

  test('total length is prefix + separator + size', () => {
    const id = prefixedId('test', 15, '-')
    // test (4) + - (1) + 15 = 20
    assert.equal(id.length, 20)
  })

  test('throws error for non-string prefix', () => {
    assert.throws(() => prefixedId(123))
    assert.throws(() => prefixedId(null))
    assert.throws(() => prefixedId(undefined))
    assert.throws(() => prefixedId({}))
    assert.throws(() => prefixedId([]))
  })

  test('works with empty prefix', () => {
    const id = prefixedId('')
    assert.ok(id.startsWith('_'))
  })

  test('works with various separators', () => {
    assert.ok(prefixedId('test', 10, '-').includes('-'))
    assert.ok(prefixedId('test', 10, ':').includes(':'))
    assert.ok(prefixedId('test', 10, '.').includes('.'))
    assert.ok(prefixedId('test', 10, '').length === 4 + 10) // no separator
  })
})

describe('sortableId()', () => {
  test('generates 22 character ID by default', () => {
    const id = sortableId()
    assert.equal(id.length, 22)
  })

  test('respects custom size', () => {
    const id = sortableId(30)
    assert.equal(id.length, 30)
  })

  test('IDs are chronologically sortable', async () => {
    const id1 = sortableId()
    await new Promise(r => setTimeout(r, 10))
    const id2 = sortableId()
    await new Promise(r => setTimeout(r, 10))
    const id3 = sortableId()

    assert.ok(id1 < id2, `${id1} should be less than ${id2}`)
    assert.ok(id2 < id3, `${id2} should be less than ${id3}`)
  })

  test('uses Crockford Base32 alphabet', () => {
    const id = sortableId()
    // Crockford Base32: 0-9, A-H, J-K, M-N, P-T, V-Z (no I, L, O, U)
    assert.match(id, /^[0-9A-HJKMNP-TV-Z]+$/i)
  })

  test('generates unique IDs', () => {
    const ids = new Set()
    for (let i = 0; i < 1000; i++) {
      ids.add(sortableId())
    }
    assert.equal(ids.size, 1000)
  })

  test('same-millisecond IDs are monotonically increasing', () => {
    // Generate multiple IDs in quick succession (likely same ms)
    const ids = []
    for (let i = 0; i < 100; i++) {
      ids.push(sortableId())
    }

    // Check all are unique
    const unique = new Set(ids)
    assert.equal(unique.size, 100, 'All IDs should be unique')

    // Check monotonic ordering
    for (let i = 1; i < ids.length; i++) {
      assert.ok(ids[i - 1] < ids[i], `ID ${i - 1} should be less than ID ${i}`)
    }
  })

  test('can decode timestamp', () => {
    const before = Date.now()
    const id = sortableId()
    const after = Date.now()

    const decoded = decodeTime(id)
    assert.ok(decoded instanceof Date)
    assert.ok(decoded.getTime() >= before)
    assert.ok(decoded.getTime() <= after)
  })

  test('size less than 22 truncates ID', () => {
    const id = sortableId(10)
    assert.equal(id.length, 10)
    // Should still be valid Crockford Base32
    assert.match(id, /^[0-9A-HJKMNP-TV-Z]+$/i)
  })

  test('size greater than 22 extends with random', () => {
    const id = sortableId(30)
    assert.equal(id.length, 30)
    // First 22 chars are Crockford, rest are urlAlphabet
  })

  test('handles size of 0', () => {
    // Size 0 should return empty or minimal
    const id = sortableId(0)
    assert.equal(id, '')
  })

  test('handles negative size', () => {
    const id = sortableId(-5)
    assert.equal(id, '')
  })

  test('very small size works', () => {
    const id = sortableId(1)
    assert.equal(id.length, 1)
  })

  test('remains monotonic across a simulated clock rewind', () => {
    const realNow = Date.now
    let virtualNow = realNow()
    Date.now = () => virtualNow
    try {
      const a = sortableId()
      // System clock jumps backwards by 1 second (NTP correction, VM resume, etc.)
      virtualNow -= 1000
      const b = sortableId()
      assert.ok(b >= a, `clock rewind broke monotonicity: ${a} -> ${b}`)
      let prev = b
      for (let i = 0; i < 100; i++) {
        virtualNow += 1
        const cur = sortableId()
        assert.ok(cur >= prev)
        prev = cur
      }
    } finally {
      Date.now = realNow
    }
  })
})

describe('decodeTime()', () => {
  test('decodes timestamp correctly', () => {
    const now = Date.now()
    const id = sortableId()
    const decoded = decodeTime(id)

    // Should be within 1 second of now
    assert.ok(Math.abs(decoded.getTime() - now) < 1000)
  })

  test('throws error for invalid ID', () => {
    assert.throws(() => decodeTime(''))
    assert.throws(() => decodeTime('short'))
    assert.throws(() => decodeTime(null))
  })

  test('throws error for invalid characters', () => {
    assert.throws(() => decodeTime('IIIIIIIIOO')) // I and O are invalid in Crockford
  })

  test('handles lowercase input (case insensitive)', () => {
    const id = sortableId()
    const lowerId = id.toLowerCase()
    const decoded1 = decodeTime(id)
    const decoded2 = decodeTime(lowerId)
    assert.equal(decoded1.getTime(), decoded2.getTime())
  })

  test('throws for non-string input', () => {
    assert.throws(() => decodeTime(12345))
    assert.throws(() => decodeTime({}))
    assert.throws(() => decodeTime([]))
  })
})

describe('generateMany()', () => {
  test('generates correct number of IDs', () => {
    assert.equal(generateMany(5).length, 5)
    assert.equal(generateMany(100).length, 100)
    assert.equal(generateMany(1).length, 1)
  })

  test('generates IDs with default size', () => {
    const ids = generateMany(10)
    ids.forEach(id => {
      assert.equal(id.length, 21)
    })
  })

  test('generates IDs with custom size', () => {
    const ids = generateMany(10, 8)
    ids.forEach(id => {
      assert.equal(id.length, 8)
    })
  })

  test('all generated IDs are unique', () => {
    const ids = generateMany(10000)
    const unique = new Set(ids)
    assert.equal(unique.size, 10000)
  })

  test('throws when count exceeds max (1M)', () => {
    assert.throws(() => generateMany(1_000_001), /exceeds maximum/)
  })

  test('returns array type', () => {
    const ids = generateMany(5)
    assert.ok(Array.isArray(ids))
  })

  test('all IDs are strings', () => {
    const ids = generateMany(10)
    ids.forEach(id => {
      assert.type(id, 'string')
    })
  })

  test('all IDs are URL-safe', () => {
    const ids = generateMany(100)
    ids.forEach(id => {
      assert.match(id, /^[A-Za-z0-9_-]+$/)
    })
  })

  test('handles zero count', () => {
    const ids = generateMany(0)
    assert.equal(ids.length, 0)
  })

  test('handles negative count', () => {
    const ids = generateMany(-5)
    assert.equal(ids.length, 0)
  })
})

describe('slugId()', () => {
  test('generates 12 character ID by default', () => {
    const id = slugId()
    assert.equal(id.length, 12)
  })

  test('respects custom size', () => {
    assert.equal(slugId(8).length, 8)
    assert.equal(slugId(20).length, 20)
  })

  test('contains only lowercase and numbers', () => {
    for (let i = 0; i < 100; i++) {
      const id = slugId()
      assert.match(id, /^[a-z0-9]+$/)
    }
  })

  test('generates unique IDs', () => {
    const ids = new Set()
    for (let i = 0; i < 1000; i++) {
      ids.add(slugId())
    }
    assert.equal(ids.size, 1000)
  })

  test('is URL slug friendly (no special chars)', () => {
    for (let i = 0; i < 50; i++) {
      const id = slugId()
      assert.notMatch(id, /[_\-A-Z]/)
    }
  })
})

describe('shortId()', () => {
  test('generates 8 character ID by default', () => {
    const id = shortId()
    assert.equal(id.length, 8)
  })

  test('respects custom size', () => {
    assert.equal(shortId(6).length, 6)
    assert.equal(shortId(12).length, 12)
  })

  test('does not contain similar-looking characters', () => {
    const confusingChars = ['0', 'O', '1', 'l', 'I']
    for (let i = 0; i < 100; i++) {
      const id = shortId()
      for (const char of confusingChars) {
        assert.ok(!id.includes(char), `Should not contain ${char}`)
      }
    }
  })

  test('generates unique IDs', () => {
    const ids = new Set()
    for (let i = 0; i < 1000; i++) {
      ids.add(shortId())
    }
    assert.equal(ids.size, 1000)
  })

  test('is human-readable friendly', () => {
    // Should only contain easily distinguishable characters
    for (let i = 0; i < 50; i++) {
      const id = shortId()
      assert.match(id, /^[346789ABCDEFGHJKLMNPQRTUVWXYabcdefghjkmnpqrtwxyz]+$/)
    }
  })
})

describe('nopeidAsync()', () => {
  test('generates 21 character ID by default', async () => {
    const id = await nopeidAsync()
    assert.equal(id.length, 21)
  })

  test('respects custom size', async () => {
    const id = await nopeidAsync(15)
    assert.equal(id.length, 15)
  })

  test('returns a promise', () => {
    const result = nopeidAsync()
    assert.ok(result instanceof Promise)
  })

  test('generates URL-safe characters', async () => {
    for (let i = 0; i < 10; i++) {
      const id = await nopeidAsync()
      assert.match(id, /^[A-Za-z0-9_-]+$/)
    }
  })

  test('generates unique IDs', async () => {
    const ids = new Set()
    for (let i = 0; i < 100; i++) {
      ids.add(await nopeidAsync())
    }
    assert.equal(ids.size, 100)
  })

  test('can be used with Promise.all', async () => {
    const promises = Array.from({ length: 10 }, () => nopeidAsync())
    const ids = await Promise.all(promises)
    assert.equal(ids.length, 10)
    assert.equal(new Set(ids).size, 10)
  })

  test('returns empty string for zero/negative size', async () => {
    assert.equal(await nopeidAsync(0), '')
    assert.equal(await nopeidAsync(-5), '')
  })
})

describe('getFingerprint()', () => {
  test('returns 4 character string', () => {
    const fp = getFingerprint()
    assert.equal(fp.length, 4)
    assert.type(fp, 'string')
  })

  test('returns same value on multiple calls', () => {
    const fp1 = getFingerprint()
    const fp2 = getFingerprint()
    const fp3 = getFingerprint()
    assert.equal(fp1, fp2)
    assert.equal(fp2, fp3)
  })
})

describe('distributedId()', () => {
  test('generates ID with fingerprint prefix', () => {
    const id = distributedId()
    const fp = getFingerprint()
    assert.ok(id.startsWith(fp + '_'))
  })

  test('has correct default length (25)', () => {
    const id = distributedId()
    assert.equal(id.length, 25)
  })

  test('respects custom size', () => {
    const id = distributedId(30)
    assert.equal(id.length, 30)
  })

  test('generates unique IDs', () => {
    const ids = new Set()
    for (let i = 0; i < 100; i++) {
      ids.add(distributedId())
    }
    assert.equal(ids.size, 100)
  })

  test('throws on size below min (16)', () => {
    for (const arg of [0, -5, 3, 5, 15]) {
      assert.throws(() => distributedId(arg), /must be an integer >= 16/)
    }
  })

  test('throws on non-integer size', () => {
    assert.throws(() => distributedId(20.5), /must be an integer/)
    assert.throws(() => distributedId('25'), /must be an integer/)
  })

  test('accepts boundary size 16', () => {
    const id = distributedId(16)
    const fp = getFingerprint()
    assert.equal(id.length, 16)
    assert.ok(id.startsWith(fp + '_'))
  })

  test('fingerprint is consistent across calls', () => {
    const id1 = distributedId()
    const id2 = distributedId()
    const fp1 = id1.split('_')[0]
    const fp2 = id2.split('_')[0]
    assert.equal(fp1, fp2)
  })
})

// === ADDITIONAL EDGE CASE TESTS ===

describe('sortableId() edge cases', () => {
  test('monotonic increment overflow handling', () => {
    // Generate many IDs in same millisecond to test increment
    const ids = []
    const start = Date.now()
    while (Date.now() === start && ids.length < 100) {
      ids.push(sortableId())
    }

    // All should be unique
    const unique = new Set(ids)
    assert.equal(unique.size, ids.length, 'Same-ms IDs should be unique')

    // Should be sorted
    const sorted = [...ids].sort()
    for (let i = 0; i < ids.length; i++) {
      assert.equal(ids[i], sorted[i], 'IDs should be in sorted order')
    }
  })

  test('timestamp encoding is correct', () => {
    const id = sortableId()
    const decoded = decodeTime(id)
    const now = Date.now()

    // Decoded time should be within 1 second of now
    assert.ok(Math.abs(decoded.getTime() - now) < 1000, 'Decoded time should be recent')
  })

  test('float size is truncated', () => {
    const id = sortableId(15.9)
    assert.equal(id.length, 15)
  })
})

describe('uuid() edge cases', () => {
  test('version bits are always 4', () => {
    for (let i = 0; i < 100; i++) {
      const id = uuid()
      // Version is char 14 (0-indexed)
      assert.equal(id[14], '4', 'UUID version should be 4')
    }
  })

  test('variant bits are correct (8, 9, a, b)', () => {
    const validVariants = ['8', '9', 'a', 'b']
    for (let i = 0; i < 100; i++) {
      const id = uuid()
      // Variant is char 19 (0-indexed)
      assert.ok(validVariants.includes(id[19]), `UUID variant ${id[19]} should be 8, 9, a, or b`)
    }
  })

  test('UUID is lowercase', () => {
    for (let i = 0; i < 10; i++) {
      const id = uuid()
      assert.equal(id, id.toLowerCase(), 'UUID should be lowercase')
    }
  })
})

describe('generateMany() edge cases', () => {
  test('handles float count by truncating', () => {
    const ids = generateMany(5.9)
    assert.equal(ids.length, 5)
  })

  test('large batch generation', () => {
    const ids = generateMany(10000)
    assert.equal(ids.length, 10000)

    const unique = new Set(ids)
    assert.equal(unique.size, 10000, 'All 10000 IDs should be unique')
  })
})

describe('prefixedId() edge cases', () => {
  test('handles unicode prefix', () => {
    const id = prefixedId('用户', 10)
    assert.ok(id.startsWith('用户_'))
    assert.equal(id.length, 2 + 1 + 10) // 用户 (2 chars) + _ + 10
  })

  test('handles empty separator', () => {
    const id = prefixedId('user', 10, '')
    assert.equal(id.length, 4 + 10)
    assert.ok(id.startsWith('user'))
  })
})

describe('isValid() edge cases', () => {
  test('rejects ID with spaces', () => {
    assert.equal(isValid('abc def'), false)
  })

  test('rejects ID with newlines', () => {
    assert.equal(isValid('abc\ndef'), false)
  })

  test('validates with custom alphabet containing spaces', () => {
    assert.equal(isValid('a b c', 'abc '), true)
  })
})

describe('Concurrent generation', () => {
  test('parallel async generation produces unique IDs', async () => {
    const promises = []
    for (let i = 0; i < 1000; i++) {
      promises.push(nopeidAsync())
    }

    const ids = await Promise.all(promises)
    const unique = new Set(ids)
    assert.equal(unique.size, 1000, 'Parallel async should produce unique IDs')
  })
})

export default runTests

// Auto-run when executed directly (e.g. `node tests/features.test.js`): print summary +
// exit non-zero on failure. No-op when imported by tests/index.js (that file is argv[1]).
import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) runTests()
