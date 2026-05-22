// Encoding & Typed-ID Tests - sqidsFactory, defineId, isValidUUID, isValidULID
import { test, describe, runTests, assert } from './test-utils.js'
import {
  sqidsFactory,
  defineId,
  isValidUUID,
  isValidULID,
  uuid,
  uuidv7,
  ulid,
  alphabets,
} from '../index.js'

describe('sqidsFactory()', () => {
  const sqids = sqidsFactory()

  test('round-trips a single number', () => {
    assert.deepEqual(sqids.decode(sqids.encode([0])), [0])
    assert.deepEqual(sqids.decode(sqids.encode([42])), [42])
  })

  test('round-trips multiple numbers', () => {
    const cases = [[1, 2, 3], [100, 200, 300], [0, 0, 0], [9, 8, 7, 6, 5]]
    for (const c of cases) {
      assert.deepEqual(sqids.decode(sqids.encode(c)), c)
    }
  })

  test('round-trips large numbers (up to MAX_SAFE_INTEGER)', () => {
    const big = [Number.MAX_SAFE_INTEGER, 1234567890]
    assert.deepEqual(sqids.decode(sqids.encode(big)), big)
  })

  test('empty array encodes to empty string', () => {
    assert.equal(sqids.encode([]), '')
    assert.deepEqual(sqids.decode(''), [])
  })

  test('encode returns a non-empty string for non-empty input', () => {
    assert.ok(sqids.encode([1]).length > 0)
  })

  test('respects minLength', () => {
    const padded = sqidsFactory({ minLength: 12 })
    const id = padded.encode([1])
    assert.ok(id.length >= 12, `expected >= 12, got ${id.length}`)
    assert.deepEqual(padded.decode(id), [1])
  })

  test('decodes invalid input to empty array', () => {
    // a character outside the alphabet
    assert.deepEqual(sqids.decode('!!!'), [])
  })

  test('is deterministic across factory instances', () => {
    const a = sqidsFactory()
    const b = sqidsFactory()
    assert.equal(a.encode([1, 2, 3]), b.encode([1, 2, 3]))
  })

  test('different inputs produce different outputs', () => {
    assert.notEqual(sqids.encode([1]), sqids.encode([2]))
    assert.notEqual(sqids.encode([1, 2]), sqids.encode([2, 1]))
  })

  test('works with a custom alphabet', () => {
    const custom = sqidsFactory({ alphabet: '0123456789abcdef' })
    assert.deepEqual(custom.decode(custom.encode([255, 16])), [255, 16])
  })

  test('round-trips with a blocklist set', () => {
    const blocked = sqidsFactory({ blocklist: ['bad', 'evil'] })
    const id = blocked.encode([5, 6, 7])
    assert.deepEqual(blocked.decode(id), [5, 6, 7])
  })

  test('throws on negative or non-integer input', () => {
    assert.throws(() => sqids.encode([-1]))
    assert.throws(() => sqids.encode([1.5]))
  })

  test('throws on too-short or duplicate alphabet', () => {
    assert.throws(() => sqidsFactory({ alphabet: 'ab' }))
    assert.throws(() => sqidsFactory({ alphabet: 'aab' }))
  })
})

describe('defineId()', () => {
  test('generate produces a prefixed id', () => {
    const user = defineId('user')
    assert.ok(user.generate().startsWith('user_'))
  })

  test('default length is prefix + separator + 21', () => {
    const user = defineId('user')
    assert.equal(user.generate().length, 'user'.length + 1 + 21)
  })

  test('respects custom size', () => {
    const order = defineId('order', { size: 8 })
    assert.equal(order.generate().length, 'order'.length + 1 + 8)
  })

  test('respects custom separator', () => {
    const p = defineId('p', { separator: '-' })
    assert.ok(p.generate().startsWith('p-'))
  })

  test('respects custom alphabet', () => {
    const hex = defineId('h', { size: 10, alphabet: alphabets.hexLower })
    const id = hex.generate()
    assert.match(id.slice('h_'.length), /^[0-9a-f]{10}$/)
  })

  test('is() acts as a type guard', () => {
    const user = defineId('user')
    const id = user.generate()
    assert.ok(user.is(id))
    assert.notOk(user.is('order_abcdef'))
    assert.notOk(user.is('user_')) // empty random part is invalid
    assert.notOk(user.is(12345))
    assert.notOk(user.is(null))
  })

  test('parse returns components or null', () => {
    const user = defineId('user')
    const id = user.generate()
    const parsed = user.parse(id)
    assert.equal(parsed.prefix, 'user')
    assert.equal(parsed.id, id.slice('user_'.length))
    assert.equal(user.parse('nope'), null)
    assert.equal(user.parse('user_'), null)
  })

  test('generated ids validate against their own is()', () => {
    const acct = defineId('acct', { size: 16 })
    for (let i = 0; i < 100; i++) assert.ok(acct.is(acct.generate()))
  })

  test('throws on non-string prefix', () => {
    assert.throws(() => defineId(123))
    assert.throws(() => defineId(null))
  })
})

describe('isValidUUID()', () => {
  test('accepts a v4 UUID from uuid()', () => {
    const id = uuid()
    assert.ok(isValidUUID(id))
    assert.ok(isValidUUID(id, 4))
    assert.notOk(isValidUUID(id, 7))
  })

  test('accepts a v7 UUID from uuidv7()', () => {
    const id = uuidv7()
    assert.ok(isValidUUID(id))
    assert.ok(isValidUUID(id, 7))
  })

  test('rejects malformed strings', () => {
    assert.notOk(isValidUUID(''))
    assert.notOk(isValidUUID('not-a-uuid'))
    assert.notOk(isValidUUID('110ec58a-a0f2-4ac4-8393')) // too short
    assert.notOk(isValidUUID(12345))
    assert.notOk(isValidUUID(null))
  })

  test('rejects invalid version/variant nibbles', () => {
    assert.notOk(isValidUUID('110ec58a-a0f2-0ac4-8393-c866d813b8d1')) // version 0
    assert.notOk(isValidUUID('110ec58a-a0f2-4ac4-c393-c866d813b8d1')) // variant c
  })

  test('is case-insensitive', () => {
    const id = uuid().toUpperCase()
    assert.ok(isValidUUID(id))
  })
})

describe('isValidULID()', () => {
  test('accepts a ULID from ulid()', () => {
    for (let i = 0; i < 50; i++) assert.ok(isValidULID(ulid()))
  })

  test('rejects wrong length', () => {
    assert.notOk(isValidULID('short'))
    assert.notOk(isValidULID(ulid() + 'X'))
    assert.notOk(isValidULID(ulid().slice(0, 25)))
  })

  test('rejects Crockford-excluded characters (I, L, O, U)', () => {
    const base = '0123456789ABCDEFGHJKMNPQRS' // 26 valid chars
    assert.ok(isValidULID(base))
    assert.notOk(isValidULID('I' + base.slice(1))) // I is excluded
    assert.notOk(isValidULID(base.slice(0, 25) + 'U')) // U is excluded
  })

  test('is case-insensitive', () => {
    assert.ok(isValidULID(ulid().toLowerCase()))
  })

  test('rejects non-string input', () => {
    assert.notOk(isValidULID(12345))
    assert.notOk(isValidULID(null))
  })
})

export default runTests

// Auto-run when executed directly (e.g. `node tests/encoding.test.js`): print summary +
// exit non-zero on failure. No-op when imported by tests/index.js (that file is argv[1]).
import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) runTests()
