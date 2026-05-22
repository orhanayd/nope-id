// Non-Secure Version Tests
import { test, describe, runTests, assert } from './test-utils.js'
import {
  nopeid,
  customAlphabet,
  prefixedId,
  sortableId,
  generateMany,
  isValid,
  slugId,
  shortId,
  decodeTime,
  urlAlphabet,
  alphabets,
} from '../non-secure/index.js'

describe('non-secure nopeid()', () => {
  test('generates 21 character ID by default', () => {
    const id = nopeid()
    assert.equal(id.length, 21)
  })

  test('generates custom length ID', () => {
    assert.equal(nopeid(10).length, 10)
    assert.equal(nopeid(5).length, 5)
    assert.equal(nopeid(50).length, 50)
  })

  test('returns string type', () => {
    assert.type(nopeid(), 'string')
  })

  test('generates URL-safe characters only', () => {
    for (let i = 0; i < 100; i++) {
      const id = nopeid()
      assert.match(id, /^[A-Za-z0-9_-]+$/)
    }
  })

  test('generates reasonably unique IDs', () => {
    const ids = new Set()
    for (let i = 0; i < 1000; i++) {
      ids.add(nopeid())
    }
    // Non-secure might have slightly lower uniqueness but should still be good
    assert.ok(ids.size >= 995, `Expected at least 995 unique IDs, got ${ids.size}`)
  })

  test('is fast (uses Math.random)', () => {
    const start = performance.now()
    for (let i = 0; i < 10000; i++) {
      nopeid()
    }
    const duration = performance.now() - start
    // Should complete 10000 IDs quickly
    assert.ok(duration < 1000, `Expected < 1000ms, took ${duration}ms`)
  })
})

describe('non-secure customAlphabet()', () => {
  test('creates generator with custom alphabet', () => {
    const hexId = customAlphabet('0123456789abcdef', 16)
    const id = hexId()
    assert.equal(id.length, 16)
    assert.match(id, /^[0-9a-f]+$/)
  })

  test('works with numbers only', () => {
    const numericId = customAlphabet('0123456789', 8)
    const id = numericId()
    assert.match(id, /^\d{8}$/)
  })

  test('allows size override', () => {
    const gen = customAlphabet('abc', 10)
    assert.equal(gen(5).length, 5)
  })
})

describe('non-secure prefixedId()', () => {
  test('generates ID with prefix', () => {
    const id = prefixedId('user')
    assert.ok(id.startsWith('user_'))
  })

  test('uses custom separator', () => {
    const id = prefixedId('order', 10, '-')
    assert.ok(id.startsWith('order-'))
  })

  test('respects size parameter', () => {
    const id = prefixedId('test', 10)
    assert.equal(id.length, 15) // test (4) + _ (1) + 10 = 15
  })
})

describe('non-secure sortableId()', () => {
  test('generates chronologically sortable IDs', async () => {
    const id1 = sortableId()
    await new Promise(r => setTimeout(r, 10))
    const id2 = sortableId()

    assert.ok(id1 < id2)
  })

  test('has correct length', () => {
    assert.equal(sortableId().length, 22)
    assert.equal(sortableId(30).length, 30)
  })

  test('same-millisecond IDs are monotonically increasing', () => {
    const ids = []
    for (let i = 0; i < 100; i++) {
      ids.push(sortableId())
    }
    const unique = new Set(ids)
    assert.equal(unique.size, 100, 'All IDs should be unique')
    for (let i = 1; i < ids.length; i++) {
      assert.ok(ids[i - 1] < ids[i], `ID ${i - 1} should be less than ID ${i}`)
    }
  })
})

describe('non-secure generateMany()', () => {
  test('generates correct number of IDs', () => {
    assert.equal(generateMany(10).length, 10)
    assert.equal(generateMany(100).length, 100)
  })

  test('all IDs have correct size', () => {
    const ids = generateMany(10, 8)
    ids.forEach(id => assert.equal(id.length, 8))
  })

  test('generates mostly unique IDs', () => {
    const ids = generateMany(1000)
    const unique = new Set(ids)
    assert.ok(unique.size >= 995)
  })
})

describe('non-secure isValid()', () => {
  test('validates nopeid output', () => {
    const id = nopeid()
    assert.ok(isValid(id))
  })

  test('returns false for invalid IDs', () => {
    assert.notOk(isValid(''))
    assert.notOk(isValid(null))
    assert.notOk(isValid('abc@#$'))
  })

  test('validates with custom alphabet', () => {
    assert.ok(isValid('abc', 'abc'))
    assert.notOk(isValid('abcd', 'abc'))
  })
})

describe('non-secure slugId()', () => {
  test('generates lowercase + numbers only', () => {
    for (let i = 0; i < 50; i++) {
      const id = slugId()
      assert.match(id, /^[a-z0-9]+$/)
    }
  })

  test('has correct default length', () => {
    assert.equal(slugId().length, 12)
  })
})

describe('non-secure shortId()', () => {
  test('excludes confusing characters', () => {
    const confusing = ['0', 'O', '1', 'l', 'I']
    for (let i = 0; i < 50; i++) {
      const id = shortId()
      for (const char of confusing) {
        assert.ok(!id.includes(char))
      }
    }
  })

  test('has correct default length', () => {
    assert.equal(shortId().length, 8)
  })
})

describe('non-secure decodeTime()', () => {
  test('decodes timestamp from sortable ID', () => {
    const before = Date.now()
    const id = sortableId()
    const after = Date.now()

    const decoded = decodeTime(id)
    assert.ok(decoded instanceof Date)
    assert.ok(decoded.getTime() >= before)
    assert.ok(decoded.getTime() <= after)
  })

  test('throws error for invalid ID', () => {
    assert.throws(() => decodeTime(''))
    assert.throws(() => decodeTime('short'))
    assert.throws(() => decodeTime(null))
  })
})

describe('non-secure exports', () => {
  test('urlAlphabet is exported', () => {
    assert.equal(urlAlphabet.length, 64)
  })

  test('alphabets is exported', () => {
    assert.ok(alphabets.alphanumeric)
    assert.ok(alphabets.lowercase)
    assert.ok(alphabets.numbers)
  })
})

export default runTests

// Auto-run when executed directly (e.g. `node tests/non-secure.test.js`): print summary +
// exit non-zero on failure. No-op when imported by tests/index.js (that file is argv[1]).
import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) runTests()
