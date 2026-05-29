// orderedId() tests — format, monotonicity, parse round-trip, edge cases.
import { test, describe, runTests, assert } from './test-utils.js'
import { orderedId } from '../index.js'

const BASE58_RE = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{21}$/

describe('orderedId() — format', () => {
  test('emits 21-char Base58 string', () => {
    for (let i = 0; i < 100; i++) {
      const id = orderedId()
      assert.equal(id.length, 21)
      assert.match(id, BASE58_RE)
    }
  })

  test('contains no Base58-invalid chars (0, O, I, l)', () => {
    for (let i = 0; i < 200; i++) {
      const id = orderedId()
      assert.notMatch(id, /[0OIl]/)
    }
  })

  test('returns distinct values across calls', () => {
    const seen = new Set()
    for (let i = 0; i < 10000; i++) seen.add(orderedId())
    assert.equal(seen.size, 10000)
  })
})

describe('orderedId() — monotonicity', () => {
  test('strictly increasing within the same millisecond', () => {
    const ids = []
    for (let i = 0; i < 500; i++) ids.push(orderedId())
    for (let i = 1; i < ids.length; i++) {
      assert.ok(ids[i] > ids[i - 1], `${ids[i - 1]} < ${ids[i]} expected`)
    }
  })

  test('strictly increasing across millisecond boundaries', async () => {
    const a = orderedId()
    await new Promise(r => setTimeout(r, 5))
    const b = orderedId()
    await new Promise(r => setTimeout(r, 5))
    const c = orderedId()
    assert.ok(a < b)
    assert.ok(b < c)
  })

  test('keeps strict monotonicity past a 58-call head-carry burst', () => {
    // 58 calls cycle the counter tail through Base58; the next call carries
    // into the counter head. Burst past several segment boundaries and make
    // sure each ID is still > the previous one.
    const ids = []
    for (let i = 0; i < 300; i++) ids.push(orderedId())
    for (let i = 1; i < ids.length; i++) {
      assert.ok(ids[i] > ids[i - 1])
    }
  })
})

describe('orderedId() — parse round-trip', () => {
  test('parse returns Date, counter number, and 8-char random tail', () => {
    const id = orderedId()
    const parts = orderedId.parse(id)
    assert.instanceOf(parts.timestamp, Date)
    assert.type(parts.counter, 'number')
    assert.equal(parts.random.length, 8)
    assert.match(parts.random, /^[123456789A-HJ-NP-Za-km-z]{8}$/)
  })

  test('parsed timestamp matches creation time within a few ms', () => {
    const before = Date.now()
    const id = orderedId()
    const after = Date.now()
    const { timestamp } = orderedId.parse(id)
    const ts = timestamp.getTime()
    assert.ok(ts >= before - 1)
    assert.ok(ts <= after + 1)
  })

  test('throws on invalid input', () => {
    assert.throws(() => orderedId.parse(''))
    assert.throws(() => orderedId.parse('1'.repeat(20)))   // too short
    assert.throws(() => orderedId.parse('1'.repeat(22)))   // too long
    assert.throws(() => orderedId.parse('0'.repeat(21)))   // '0' not in Base58
    assert.throws(() => orderedId.parse(null))
    assert.throws(() => orderedId.parse(undefined))
  })
})

describe('orderedId() — asciiBytes', () => {
  test('returns a 21-byte buffer matching the string char codes', () => {
    const bytes = orderedId.asciiBytes()
    assert.equal(bytes.length, 21)
    for (let i = 0; i < 21; i++) {
      assert.ok(bytes[i] > 0x20 && bytes[i] < 0x7f)
    }
  })
})

describe('orderedId.many() — batch', () => {
  test('returns exactly count IDs, all 21-char Base58, all distinct', () => {
    const ids = orderedId.many(5000)
    assert.equal(ids.length, 5000)
    const seen = new Set()
    for (const id of ids) {
      assert.equal(id.length, 21)
      assert.match(id, BASE58_RE)
      seen.add(id)
    }
    assert.equal(seen.size, 5000)
  })

  test('batch is strictly increasing (sorts in creation order)', () => {
    const ids = orderedId.many(5000)
    for (let i = 1; i < ids.length; i++) {
      assert.ok(ids[i] > ids[i - 1], `${ids[i - 1]} < ${ids[i]} expected`)
    }
  })

  test('stays strictly monotonic across the 4096-ID clock-refresh boundary', () => {
    // > 4096 forces at least one mid-batch Date.now() refresh; the counter must
    // carry ordering across that boundary with no duplicate or inversion.
    const ids = orderedId.many(10000)
    for (let i = 1; i < ids.length; i++) {
      assert.ok(ids[i] > ids[i - 1])
    }
  })

  test('shares state with orderedId(): interleaving stays monotonic', () => {
    const a = orderedId()
    const batch = orderedId.many(1000)
    const b = orderedId()
    assert.ok(batch[0] > a, 'first batch ID > prior single ID')
    assert.ok(b > batch[batch.length - 1], 'single ID after batch > last batch ID')
  })

  test('parsed timestamps are non-decreasing and within batch wall-clock window', () => {
    const before = Date.now()
    const ids = orderedId.many(20000)
    const after = Date.now()
    let last = 0
    for (const id of ids) {
      const ts = orderedId.parse(id).timestamp.getTime()
      assert.ok(ts >= last, 'timestamps non-decreasing within batch')
      last = ts
      // Clock is sampled at batch start + every 4096 IDs, so each embedded ts is
      // a Date.now() read taken during the call; allow 2 ms slack at the edges.
      assert.ok(ts >= before - 2 && ts <= after + 2, `ts ${ts} within [${before},${after}]`)
    }
  })

  test('count edge cases: <= 0 returns [], over the cap throws', () => {
    assert.equal(orderedId.many(0).length, 0)
    assert.equal(orderedId.many(-5).length, 0)
    assert.equal(orderedId.many(1).length, 1)
    assert.throws(() => orderedId.many(1_000_001))
  })
})

export default runTests

// Auto-run when executed directly. No-op when imported by tests/index.js.
import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) runTests()
