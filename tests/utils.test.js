// Utility Functions Tests - isValid, collisionProbability, uuid
import { test, describe, runTests, assert } from './test-utils.js'
import {
  isValid,
  collisionProbability,
  uuid,
  nopeid,
  urlAlphabet,
  alphabets,
  customAlphabet,
} from '../index.js'

describe('isValid()', () => {
  test('returns true for valid nopeid', () => {
    const id = nopeid()
    assert.ok(isValid(id))
  })

  test('returns true for valid custom IDs', () => {
    assert.ok(isValid('abc123'))
    assert.ok(isValid('V1StGXR8_Z5jdHi6B-myT'))
    assert.ok(isValid('a'))
  })

  test('returns false for empty string', () => {
    assert.notOk(isValid(''))
  })

  test('returns false for null', () => {
    assert.notOk(isValid(null))
  })

  test('returns false for undefined', () => {
    assert.notOk(isValid(undefined))
  })

  test('returns false for non-string types', () => {
    assert.notOk(isValid(123))
    assert.notOk(isValid({}))
    assert.notOk(isValid([]))
    assert.notOk(isValid(true))
  })

  test('returns false for invalid characters', () => {
    assert.notOk(isValid('abc@#$'))
    assert.notOk(isValid('hello world'))
    assert.notOk(isValid('test!'))
    assert.notOk(isValid('id=123'))
  })

  test('validates against custom alphabet', () => {
    assert.ok(isValid('abc', 'abc'))
    assert.notOk(isValid('abcd', 'abc'))
    assert.ok(isValid('123', '0123456789'))
    assert.notOk(isValid('12a', '0123456789'))
  })

  test('validates hex IDs', () => {
    assert.ok(isValid('0123456789abcdef', alphabets.hexLower))
    assert.notOk(isValid('0123456789abcdefg', alphabets.hexLower))
  })

  test('validates generated IDs from customAlphabet', () => {
    const hexGen = customAlphabet(alphabets.hexLower, 16)
    const hexId = hexGen()
    assert.ok(isValid(hexId, alphabets.hexLower))
    assert.notOk(isValid(hexId + 'z', alphabets.hexLower))
  })

  test('uses urlAlphabet by default', () => {
    // All URL-safe characters should be valid
    assert.ok(isValid('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'))
  })
})

describe('collisionProbability()', () => {
  test('returns object with correct properties', () => {
    const result = collisionProbability(21)
    assert.ok('totalPossible' in result)
    assert.ok('probabilityForBillion' in result)
    assert.ok('safeCount' in result)
  })

  test('totalPossible is correct for 21 chars with 64 alphabet', () => {
    const result = collisionProbability(21, 64)
    // 64^21 = 4.7e37 approximately
    assert.ok(result.totalPossible > 1e37)
  })

  test('shorter IDs have fewer possibilities', () => {
    const short = collisionProbability(8)
    const long = collisionProbability(21)
    assert.ok(short.totalPossible < long.totalPossible)
  })

  test('smaller alphabet means fewer possibilities', () => {
    const small = collisionProbability(21, 10)
    const large = collisionProbability(21, 64)
    assert.ok(small.totalPossible < large.totalPossible)
  })

  test('probabilityForBillion is very small for 21 chars', () => {
    const result = collisionProbability(21)
    // Should be essentially zero for practical purposes
    assert.ok(result.probabilityForBillion < 1e-10)
  })

  test('probabilityForBillion increases for shorter IDs', () => {
    const short = collisionProbability(8)
    const long = collisionProbability(21)
    assert.ok(short.probabilityForBillion > long.probabilityForBillion)
  })

  test('safeCount is positive', () => {
    const result = collisionProbability(21)
    assert.ok(result.safeCount > 0)
  })

  test('safeCount is larger for longer IDs', () => {
    const short = collisionProbability(8)
    const long = collisionProbability(21)
    assert.ok(short.safeCount < long.safeCount)
  })

  test('works with various lengths', () => {
    [4, 8, 12, 16, 21, 32].forEach(length => {
      const result = collisionProbability(length)
      assert.type(result.totalPossible, 'number')
      assert.type(result.probabilityForBillion, 'number')
      assert.type(result.safeCount, 'number')
    })
  })

  test('works with various alphabet sizes', () => {
    [2, 10, 16, 36, 62, 64].forEach(size => {
      const result = collisionProbability(21, size)
      assert.ok(result.totalPossible > 0)
    })
  })
})

describe('uuid()', () => {
  test('generates valid UUID v4 format', () => {
    const id = uuid()
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  test('has correct length (36 characters)', () => {
    const id = uuid()
    assert.equal(id.length, 36)
  })

  test('version nibble is 4', () => {
    const id = uuid()
    // Character at position 14 should be '4'
    assert.equal(id[14], '4')
  })

  test('variant nibble is 8, 9, a, or b', () => {
    for (let i = 0; i < 100; i++) {
      const id = uuid()
      // Character at position 19 should be 8, 9, a, or b
      assert.match(id[19], /[89ab]/)
    }
  })

  test('generates unique UUIDs', () => {
    const ids = new Set()
    for (let i = 0; i < 1000; i++) {
      ids.add(uuid())
    }
    assert.equal(ids.size, 1000)
  })

  test('uses lowercase hex characters', () => {
    const id = uuid()
    // Remove hyphens and check all are lowercase hex
    const hex = id.replace(/-/g, '')
    assert.match(hex, /^[0-9a-f]+$/)
    assert.notMatch(hex, /[A-F]/)
  })

  test('has hyphens at correct positions', () => {
    const id = uuid()
    assert.equal(id[8], '-')
    assert.equal(id[13], '-')
    assert.equal(id[18], '-')
    assert.equal(id[23], '-')
  })

  test('hex parts have correct lengths', () => {
    const id = uuid()
    const parts = id.split('-')
    assert.equal(parts.length, 5)
    assert.equal(parts[0].length, 8)
    assert.equal(parts[1].length, 4)
    assert.equal(parts[2].length, 4)
    assert.equal(parts[3].length, 4)
    assert.equal(parts[4].length, 12)
  })

  test('can be used in standard UUID contexts', () => {
    const id = uuid()
    // Should be parseable as a valid UUID
    const withoutHyphens = id.replace(/-/g, '')
    assert.equal(withoutHyphens.length, 32)
  })

  test('different calls produce different UUIDs', () => {
    const id1 = uuid()
    const id2 = uuid()
    const id3 = uuid()
    assert.notEqual(id1, id2)
    assert.notEqual(id2, id3)
    assert.notEqual(id1, id3)
  })
})

export default runTests
