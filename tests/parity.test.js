// Parity Tests - index.cjs and non-secure/index.cjs runtime coverage.
// The CJS files are hand-maintained mirrors of the ESM sources with no build
// step; nothing else in the suite imports them, so a change ported to one
// mirror but not the other would ship silently. These tests load the CJS
// builds through createRequire and assert (a) the export surface matches the
// ESM module exactly and (b) a compact behavioral contract holds on the same
// hot paths the ESM suites cover in depth.
import { createRequire } from 'node:module'
import { test, describe, runTests, assert } from './test-utils.js'
import * as esm from '../index.js'
import * as esmNonSecure from '../non-secure/index.js'
// Surface + validation-error checks only: module evaluation touches no CSPRNG,
// and every trigger below throws before any crypto call, so this stays
// runnable under plain `npm test` even without a webcrypto global.
import * as browser from '../index.browser.js'

const require = createRequire(import.meta.url)
const cjs = require('../index.cjs')
const cjsNonSecure = require('../non-secure/index.cjs')

const URL_SAFE = /^[A-Za-z0-9_-]+$/

describe('index.cjs export surface', () => {
  test('every ESM named export exists on the CJS module', () => {
    const esmKeys = Object.keys(esm).filter(k => k !== 'default')
    const missing = esmKeys.filter(k => !(k in cjs))
    assert.deepEqual(missing, [], `CJS is missing exports: ${missing.join(', ')}`)
  })

  test('CJS has no extra exports beyond the ESM surface', () => {
    const esmKeys = new Set(Object.keys(esm))
    const extra = Object.keys(cjs).filter(k => !esmKeys.has(k))
    assert.deepEqual(extra, [], `CJS has extra exports: ${extra.join(', ')}`)
  })

  test('module.exports itself and .default are the nopeid function', () => {
    assert.type(cjs, 'function')
    assert.equal(cjs, cjs.nopeid)
    assert.equal(cjs.default, cjs.nopeid)
  })

  test('urlAlphabet and alphabets values match the ESM module', () => {
    assert.equal(cjs.urlAlphabet, esm.urlAlphabet)
    assert.deepEqual({ ...cjs.alphabets }, { ...esm.alphabets })
  })
})

describe('index.cjs behavioral contract', () => {
  test('nopeid: default 21 chars, URL-safe, size honored, non-positive empty', () => {
    assert.equal(cjs.nopeid().length, 21)
    assert.equal(cjs.nopeid(10).length, 10)
    assert.equal(cjs.nopeid(0), '')
    assert.equal(cjs.nopeid(-5), '')
    for (let i = 0; i < 50; i++) assert.match(cjs.nopeid(), URL_SAFE)
  })

  test('nopeid: 5000 IDs are unique', () => {
    const ids = new Set()
    for (let i = 0; i < 5000; i++) ids.add(cjs.nopeid())
    assert.equal(ids.size, 5000)
  })

  test('customAlphabet: hex generator format and validation throws', () => {
    const hex = cjs.customAlphabet('0123456789abcdef', 16)
    for (let i = 0; i < 50; i++) assert.match(hex(), /^[0-9a-f]{16}$/)
    assert.throws(() => cjs.customAlphabet(''))
    assert.throws(() => cjs.customAlphabet('a'.repeat(257)))
    assert.throws(() => cjs.customAlphabet('aab'))
  })

  test('uuid: v4 version and variant nibbles', () => {
    for (let i = 0; i < 50; i++) {
      const u = cjs.uuid()
      assert.equal(u.length, 36)
      assert.equal(u[14], '4')
      assert.ok('89ab'.includes(u[19]), `variant nibble was ${u[19]}`)
    }
  })

  test('orderedId: 21-char Base58, monotonic, parse round-trips', () => {
    const before = Date.now()
    const a = cjs.orderedId()
    const b = cjs.orderedId()
    const after = Date.now()
    assert.match(a, /^[1-9A-HJ-NP-Za-km-z]{21}$/)
    assert.ok(b > a, 'consecutive orderedIds must be strictly increasing')
    const parsed = cjs.orderedId.parse(a)
    assert.between(parsed.timestamp.getTime(), before - 2, after + 2)
  })

  test('generateMany: count honored, IDs unique and URL-safe', () => {
    const ids = cjs.generateMany(500)
    assert.equal(ids.length, 500)
    assert.equal(new Set(ids).size, 500)
    ids.forEach(id => assert.match(id, URL_SAFE))
  })

  test('secureToken / isValid / random work through CJS', () => {
    const t = cjs.secureToken()
    assert.equal(t.length, 48)
    assert.match(t, URL_SAFE)
    assert.ok(cjs.isValid(t))
    assert.notOk(cjs.isValid('has space'))
    assert.equal(cjs.random(32).length, 32)
  })
})

describe('index.browser.js export surface', () => {
  test('browser surface matches the ESM module exactly (both directions)', () => {
    assert.deepEqual(
      Object.keys(browser).sort(),
      Object.keys(esm).sort(),
      'browser exports must equal ESM exports'
    )
  })
})

describe('error-message parity across the three secure builds', () => {
  test('every validation error message is byte-identical in esm/cjs/browser', () => {
    // Each trigger throws during validation, before any CSPRNG is touched.
    const triggers = [
      m => m.customAlphabet(''),
      m => m.customAlphabet('a'.repeat(257)),
      m => m.customAlphabet('aab'),
      m => m.customRandom('ab', 10, () => new Uint8Array(1))(),
      m => m.ulid(NaN),
      m => m.ulid(-1),
      m => m.monotonicFactory()(2 ** 49),
      m => m.snowflakeFactory({ nodeId: 4096 }),
      m => m.snowflakeFactory({ epoch: 'x' }),
      m => m.decodeSnowflake('abc'),
      m => m.decodeSnowflake('123', 'x'),
      m => m.secureToken(1),
      m => m.secureToken(65537),
      m => m.defineToken('x', { size: 1 }),
      m => m.defineToken('x', { size: 65537 }),
      m => m.apiKey(''),
      m => m.apiKey('has space'),
      m => m.defineId(5),
      m => m.defineId('u', { size: 0 }),
      m => m.orderedId.parse('short'),
      m => m.orderedId.parse('0'.repeat(21)),
      m => m.generateMany(2000000),
      m => m.orderedId.many(2000000),
      m => m.distributedId(4),
      m => m.decodeObjectIdTime('zz'),
      m => m.decodeTime(null),
    ]
    const msgs = mod => triggers.map(t => { try { t(mod); return null } catch (e) { return e.message } })
    const fromEsm = msgs(esm)
    assert.ok(fromEsm.every(m => m !== null), 'every trigger must throw in ESM')
    assert.deepEqual(msgs(cjs), fromEsm, 'CJS messages must match ESM')
    assert.deepEqual(msgs(browser), fromEsm, 'browser messages must match ESM')
  })
})

describe('non-secure/index.cjs parity', () => {
  test('every non-secure ESM named export exists on the CJS module', () => {
    const esmKeys = Object.keys(esmNonSecure).filter(k => k !== 'default')
    const missing = esmKeys.filter(k => !(k in cjsNonSecure))
    assert.deepEqual(missing, [], `non-secure CJS is missing: ${missing.join(', ')}`)
  })

  test('non-secure CJS has no extra exports beyond the ESM surface', () => {
    const esmKeys = new Set(Object.keys(esmNonSecure))
    const extra = Object.keys(cjsNonSecure).filter(k => !esmKeys.has(k))
    assert.deepEqual(extra, [], `non-secure CJS has extra exports: ${extra.join(', ')}`)
  })

  test('nopeid: default 21 chars, URL-safe, size honored', () => {
    assert.equal(cjsNonSecure.nopeid().length, 21)
    assert.equal(cjsNonSecure.nopeid(10).length, 10)
    for (let i = 0; i < 50; i++) assert.match(cjsNonSecure.nopeid(), URL_SAFE)
  })

  test('sortableId and decodeTime round-trip', () => {
    const before = Date.now()
    const id = cjsNonSecure.sortableId()
    assert.equal(id.length, 22)
    const decoded = cjsNonSecure.decodeTime(id)
    assert.between(decoded.getTime(), before - 1000, Date.now() + 1000)
  })
})

export default runTests

// Auto-run when executed directly (e.g. `node tests/parity.test.js`): print summary +
// exit non-zero on failure. No-op when imported by tests/index.js (that file is argv[1]).
import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) runTests()
