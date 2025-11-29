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
})

export default runTests
