// New ID Types Tests - uuidv7, ulid, monotonicFactory, snowflake, objectId
import { test, describe, runTests, assert } from './test-utils.js'
import {
  uuidv7,
  ulid,
  monotonicFactory,
  snowflakeFactory,
  snowflake,
  decodeSnowflake,
  objectId,
  decodeObjectIdTime,
  decodeTime,
  isValidUUID,
  isValidULID,
} from '../index.js'

const sleep = ms => new Promise(r => setTimeout(r, ms))

describe('uuidv7()', () => {
  test('generates 36-character string', () => {
    assert.equal(uuidv7().length, 36)
  })

  test('matches UUID v7 format', () => {
    for (let i = 0; i < 50; i++) {
      assert.match(
        uuidv7(),
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      )
    }
  })

  test('version nibble is 7', () => {
    for (let i = 0; i < 50; i++) assert.equal(uuidv7()[14], '7')
  })

  test('variant nibble is 8, 9, a, or b', () => {
    const valid = ['8', '9', 'a', 'b']
    for (let i = 0; i < 50; i++) assert.ok(valid.includes(uuidv7()[19]))
  })

  test('passes isValidUUID and isValidUUID(_, 7)', () => {
    const id = uuidv7()
    assert.ok(isValidUUID(id))
    assert.ok(isValidUUID(id, 7))
    assert.notOk(isValidUUID(id, 4))
  })

  test('embedded timestamp is close to now', () => {
    const before = Date.now()
    const id = uuidv7()
    const ms = parseInt(id.replace(/-/g, '').slice(0, 12), 16)
    assert.ok(Math.abs(ms - before) < 2000, `embedded ms ${ms} not near ${before}`)
  })

  test('is time-ordered across milliseconds', async () => {
    const a = uuidv7()
    await sleep(5)
    const b = uuidv7()
    await sleep(5)
    const c = uuidv7()
    assert.ok(a < b && b < c, 'uuidv7 should sort chronologically')
  })

  test('generates unique IDs', () => {
    const ids = new Set()
    for (let i = 0; i < 5000; i++) ids.add(uuidv7())
    assert.equal(ids.size, 5000)
  })
})

describe('ulid()', () => {
  test('generates 26-character ID', () => {
    assert.equal(ulid().length, 26)
  })

  test('uses Crockford Base32 (passes isValidULID)', () => {
    for (let i = 0; i < 50; i++) assert.ok(isValidULID(ulid()))
  })

  test('decodeTime returns recent timestamp', () => {
    const now = Date.now()
    const decoded = decodeTime(ulid())
    assert.ok(Math.abs(decoded.getTime() - now) < 2000)
  })

  test('honors a seed time', () => {
    const seed = 1700000000000
    const id = ulid(seed)
    assert.equal(decodeTime(id).getTime(), seed)
  })

  test('is chronologically sortable across ms', async () => {
    const a = ulid()
    await sleep(5)
    const b = ulid()
    assert.ok(a < b)
  })

  test('generates unique IDs', () => {
    const ids = new Set()
    for (let i = 0; i < 5000; i++) ids.add(ulid())
    assert.equal(ids.size, 5000)
  })
})

describe('monotonicFactory()', () => {
  test('returns a generator function', () => {
    assert.type(monotonicFactory(), 'function')
  })

  test('same-millisecond IDs are strictly increasing and unique', () => {
    const next = monotonicFactory()
    const ids = []
    for (let i = 0; i < 200; i++) ids.push(next())
    assert.equal(new Set(ids).size, 200, 'all unique')
    for (let i = 1; i < ids.length; i++) {
      assert.ok(ids[i - 1] < ids[i], `id ${i - 1} should be < id ${i}`)
    }
  })

  test('output is a valid 26-char ULID', () => {
    const next = monotonicFactory()
    const id = next()
    assert.equal(id.length, 26)
    assert.ok(isValidULID(id))
  })

  test('factories have isolated state', () => {
    const a = monotonicFactory()
    const b = monotonicFactory()
    const aIds = []
    const bIds = []
    for (let i = 0; i < 50; i++) {
      aIds.push(a())
      bIds.push(b())
    }
    // each sequence is independently monotonic
    for (let i = 1; i < 50; i++) {
      assert.ok(aIds[i - 1] < aIds[i], 'factory A monotonic')
      assert.ok(bIds[i - 1] < bIds[i], 'factory B monotonic')
    }
  })
})

describe('snowflakeFactory() / snowflake()', () => {
  test('factory returns string ids', () => {
    const next = snowflakeFactory({ nodeId: 1 })
    assert.type(next(), 'string')
  })

  test('decodeSnowflake round-trips node id and timestamp', () => {
    const next = snowflakeFactory({ nodeId: 42 })
    const before = Date.now()
    const id = next()
    const parts = decodeSnowflake(id)
    assert.equal(parts.nodeId, 42)
    assert.ok(Math.abs(parts.timestamp.getTime() - before) < 2000)
    assert.ok(parts.sequence >= 0 && parts.sequence < 4096)
  })

  test('ids are monotonically increasing (BigInt order)', () => {
    const next = snowflakeFactory({ nodeId: 1 })
    const ids = []
    for (let i = 0; i < 200; i++) ids.push(next())
    for (let i = 1; i < ids.length; i++) {
      assert.ok(BigInt(ids[i - 1]) < BigInt(ids[i]), `snowflake ${i} should increase`)
    }
  })

  test('generates unique IDs', () => {
    const next = snowflakeFactory({ nodeId: 7 })
    const ids = new Set()
    for (let i = 0; i < 5000; i++) ids.add(next())
    assert.equal(ids.size, 5000)
  })

  test('node id is masked to 10 bits', () => {
    assert.equal(decodeSnowflake(snowflakeFactory({ nodeId: 1023 })()).nodeId, 1023)
    assert.equal(decodeSnowflake(snowflakeFactory({ nodeId: 1024 })()).nodeId, 0)
  })

  test('custom epoch round-trips with decodeSnowflake', () => {
    const epoch = 1500000000000n
    const next = snowflakeFactory({ nodeId: 3, epoch })
    const before = Date.now()
    const parts = decodeSnowflake(next(), epoch)
    assert.ok(Math.abs(parts.timestamp.getTime() - before) < 2000)
  })

  test('default snowflake() returns a string', () => {
    assert.type(snowflake(), 'string')
    assert.notEqual(snowflake(), snowflake())
  })
})

describe('objectId()', () => {
  test('generates 24-character hex string', () => {
    for (let i = 0; i < 50; i++) assert.match(objectId(), /^[0-9a-f]{24}$/)
  })

  test('decodeObjectIdTime returns recent timestamp', () => {
    const now = Date.now()
    const decoded = decodeObjectIdTime(objectId())
    assert.ok(Math.abs(decoded.getTime() - now) < 2000)
  })

  test('counter increments between consecutive ids', () => {
    const a = parseInt(objectId().slice(18), 16)
    const b = parseInt(objectId().slice(18), 16)
    assert.notEqual(a, b)
  })

  test('machine part is stable within a process', () => {
    const a = objectId().slice(8, 18)
    const b = objectId().slice(8, 18)
    assert.equal(a, b)
  })

  test('generates unique IDs', () => {
    const ids = new Set()
    for (let i = 0; i < 5000; i++) ids.add(objectId())
    assert.equal(ids.size, 5000)
  })

  test('decodeObjectIdTime throws on short input', () => {
    assert.throws(() => decodeObjectIdTime('abc'))
    assert.throws(() => decodeObjectIdTime(null))
  })

  test('decodeObjectIdTime throws on non-hex 24-char input', () => {
    assert.throws(() => decodeObjectIdTime('z'.repeat(24)), /Invalid ObjectId/)
    assert.throws(() => decodeObjectIdTime('g'.repeat(24)), /Invalid ObjectId/)
  })
})

export default runTests

// Auto-run when executed directly (e.g. `node tests/idtypes.test.js`): print summary +
// exit non-zero on failure. No-op when imported by tests/index.js (that file is argv[1]).
import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) runTests()
