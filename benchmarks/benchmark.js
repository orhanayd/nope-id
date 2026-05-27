// nope-id vs nanoid Performance Benchmark
// Run: node benchmarks/benchmark.js

import { nanoid, customAlphabet as nanoidCustomAlphabet } from 'nanoid'
import {
  nopeid,
  customAlphabet,
  sortableId,
  prefixedId,
  generateMany,
  uuid,
  slugId,
  shortId,
  isValid,
  uuidv7,
  ulid,
  monotonicFactory,
  snowflakeFactory,
  objectId,
  sqidsFactory,
} from '../index.js'
import { randomUUID } from 'node:crypto'
import { v4 as uuidV4, v7 as uuidV7 } from 'uuid'
import { ulid as ulidPkg, monotonicFactory as ulidMonoFactory } from 'ulid'
import { createId as cuid2 } from '@paralleldrive/cuid2'
import rndm from 'rndm'
import srs from 'secure-random-string'
import { uid } from 'uid/secure'
import { v4 as lukeedUuid } from '@lukeed/uuid'
import { generateId as sparkidGen } from 'sparkid'

const TRIALS = 7
const TARGET_MS = 120

// --json: emit a structured results object to stdout instead of the colored
// console report. Used by scripts/update-readme.js (and CI) to refresh README
// perf tables without scraping ANSI-coloured text.
const JSON_MODE = process.argv.includes('--json')
const log = JSON_MODE ? () => {} : console.log

const results = {
  meta: {
    date: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    runner: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local',
  },
  comparison: {},
  uuid: {},
  ulid: {},
  vs_others: {},
  extras: {},
}

const record = (group, key, opsPerSec, extra = {}) => {
  results[group][key] = { opsPerSec, ...extra }
}

const recordComparison = (key, nanoidRes, nopeidRes) => {
  results.comparison[key] = {
    nanoid: nanoidRes.opsPerSec,
    nopeid: nopeidRes.opsPerSec,
    ratio: +(nopeidRes.opsPerSec / nanoidRes.opsPerSec).toFixed(2),
  }
}

// Best-of-N timing with auto-calibrated iteration counts. A fixed iteration count
// under-reports very fast functions (e.g. native crypto.randomUUID() at ~20M+ ops/sec
// gets too short a measurement window); calibrating each function to a ~120ms window
// keeps fast and slow tools alike accurate. The calibration loop also serves as warmup.
const benchmark = (name, fn) => {
  let calIters = 2000
  let calMs = 0
  while (calMs < 5) {
    const start = performance.now()
    for (let i = 0; i < calIters; i++) fn()
    calMs = performance.now() - start
    if (calMs < 5) calIters *= 4
  }
  const iters = Math.max(2000, Math.ceil((calIters / calMs) * TARGET_MS))

  let opsPerSec = 0
  for (let t = 0; t < TRIALS; t++) {
    const start = performance.now()
    for (let i = 0; i < iters; i++) fn()
    const rate = Math.round((iters / (performance.now() - start)) * 1000)
    if (rate > opsPerSec) opsPerSec = rate
  }

  return { name, opsPerSec }
}

// Format number with commas
const formatNumber = num => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

// Print result
const printResult = (result, baseline = null) => {
  const ops = formatNumber(result.opsPerSec)
  let comparison = ''

  if (baseline) {
    const ratio = result.opsPerSec / baseline.opsPerSec
    if (ratio > 1) {
      comparison = `  \x1b[32m${ratio.toFixed(2)}x faster\x1b[0m`
    } else if (ratio < 1) {
      comparison = `  \x1b[31m${(1 / ratio).toFixed(2)}x slower\x1b[0m`
    } else {
      comparison = '  same speed'
    }
  }

  log(`  ${result.name.padEnd(35)} ${ops.padStart(12)} ops/sec${comparison}`)
}

log('\n' + '═'.repeat(70))
log('  nope-id vs nanoid - Performance Benchmark')
log('═'.repeat(70))
log(`  Auto-calibrated ~${TARGET_MS}ms/trial | Best of ${TRIALS} trials | numbers vary by machine`)
log('─'.repeat(70))

// Measure native crypto.randomUUID() FIRST. Its throughput drops sharply once other
// CSPRNG-backed generators run in the same process (shared entropy path), so measuring
// it up front gives it a fair, un-depressed number, since we don't want to flatter ourselves
// by under-reporting the fastest tool. (Suggested in issue #4 by nanoid's author.)
const cryptoUuid = benchmark('crypto.randomUUID() (native v4)', () => randomUUID())
record('uuid', 'crypto_randomUUID', cryptoUuid.opsPerSec)

// Global warmup so the CPU/JIT is hot before the first timed comparison, since otherwise
// whichever library is measured first is unfairly penalized by a cold start.
for (let i = 0; i < 500000; i++) { nanoid(); nopeid() }

// ============================================
// 1. Basic ID Generation (21 chars)
// ============================================
log('\n\x1b[1m📊 Basic ID Generation (21 characters)\x1b[0m\n')

const nanoidBasic = benchmark('nanoid()', () => nanoid())
const nopeidBasic = benchmark('nopeid()', () => nopeid())
recordComparison('basic_21', nanoidBasic, nopeidBasic)

printResult(nanoidBasic)
printResult(nopeidBasic, nanoidBasic)

// ============================================
// 2. Custom Size (10 chars)
// ============================================
log('\n\x1b[1m📊 Custom Size (10 characters)\x1b[0m\n')

const nanoidSmall = benchmark('nanoid(10)', () => nanoid(10))
const nopeidSmall = benchmark('nopeid(10)', () => nopeid(10))
recordComparison('small_10', nanoidSmall, nopeidSmall)

printResult(nanoidSmall)
printResult(nopeidSmall, nanoidSmall)

// ============================================
// 3. Large Size (64 chars)
// ============================================
log('\n\x1b[1m📊 Large Size (64 characters)\x1b[0m\n')

const nanoidLarge = benchmark('nanoid(64)', () => nanoid(64))
const nopeidLarge = benchmark('nopeid(64)', () => nopeid(64))
recordComparison('large_64', nanoidLarge, nopeidLarge)

printResult(nanoidLarge)
printResult(nopeidLarge, nanoidLarge)

// ============================================
// 4. Custom Alphabet
// ============================================
log('\n\x1b[1m📊 Custom Alphabet (hex, 16 chars)\x1b[0m\n')

const nanoidHex = nanoidCustomAlphabet('0123456789abcdef', 16)
const nopeidHex = customAlphabet('0123456789abcdef', 16)

const nanoidCustom = benchmark('nanoid customAlphabet', () => nanoidHex())
const nopeidCustom = benchmark('nopeid customAlphabet', () => nopeidHex())
recordComparison('custom_alphabet', nanoidCustom, nopeidCustom)

printResult(nanoidCustom)
printResult(nopeidCustom, nanoidCustom)

// ============================================
// 5. nope-id Exclusive Features
// ============================================
log('\n\x1b[1m📊 nope-id Exclusive Features\x1b[0m\n')

const sortableResult = benchmark('sortableId()', () => sortableId())
const prefixedResult = benchmark("prefixedId('user')", () => prefixedId('user'))
const uuidResult = benchmark('uuid()', () => uuid())
const slugResult = benchmark('slugId()', () => slugId())
const shortResult = benchmark('shortId()', () => shortId())
// isValid uses a fixed sample so the per-call cost is just the validation, not a fresh ID
const isValidSample = nopeid()
const isValidResult = benchmark('isValid()', () => isValid(isValidSample))
record('extras', 'sortableId', sortableResult.opsPerSec)
record('extras', 'prefixedId', prefixedResult.opsPerSec)
record('extras', 'uuid', uuidResult.opsPerSec)
record('extras', 'slugId', slugResult.opsPerSec)
record('extras', 'shortId', shortResult.opsPerSec)
record('extras', 'isValid', isValidResult.opsPerSec)

printResult(sortableResult)
printResult(prefixedResult)
printResult(uuidResult)
printResult(slugResult)
printResult(shortResult)
printResult(isValidResult)

// ============================================
// 5b. New ID Types
// ============================================
log('\n\x1b[1m📊 New ID Types\x1b[0m\n')

const nextSnowflake = snowflakeFactory({ nodeId: 1 })
const nextMono = monotonicFactory()
const sqidsGen = sqidsFactory()

const uuidv7Result = benchmark('uuidv7()', () => uuidv7())
const ulidResult = benchmark('ulid()', () => ulid())
const monoNextResult = benchmark('monotonicFactory next', () => nextMono())
const snowflakeResult = benchmark('snowflake (factory)', () => nextSnowflake())
const objectIdResult = benchmark('objectId()', () => objectId())
const sqidsResult = benchmark('sqids encode [1,2,3]', () => sqidsGen.encode([1, 2, 3]))
record('extras', 'uuidv7', uuidv7Result.opsPerSec)
record('extras', 'ulid', ulidResult.opsPerSec)
record('extras', 'monotonicFactory', monoNextResult.opsPerSec)
record('extras', 'snowflake', snowflakeResult.opsPerSec)
record('extras', 'objectId', objectIdResult.opsPerSec)
record('extras', 'sqids', sqidsResult.opsPerSec)

printResult(uuidv7Result)
printResult(ulidResult)
printResult(monoNextResult)
printResult(snowflakeResult)
printResult(objectIdResult)
printResult(sqidsResult)

// ============================================
// 5c. UUID generators vs the `uuid` package and native crypto.randomUUID()
// (suggested by nanoid's author in issue #4; a fair benchmark needs more tools)
// ============================================
log('\n\x1b[1m📊 UUID generators (different tools, different trade-offs)\x1b[0m\n')

// cryptoUuid was measured up front (see above) for a fair, un-depressed native number
const uuidPkgV4 = benchmark('uuid v4 (npm)', () => uuidV4())
const lukeedV4Result = benchmark('@lukeed/uuid v4', () => lukeedUuid())
const nopeUuidV4 = benchmark('nope-id uuid() (v4)', () => uuid())
const uuidPkgV7 = benchmark('uuid v7 (npm)', () => uuidV7())
const nopeUuidV7 = benchmark('nope-id uuidv7()', () => uuidv7())
record('uuid', 'uuid_v4', uuidPkgV4.opsPerSec)
record('uuid', 'lukeed_uuid', lukeedV4Result.opsPerSec)
record('uuid', 'nope_uuid', nopeUuidV4.opsPerSec)
record('uuid', 'uuid_v7', uuidPkgV7.opsPerSec)
record('uuid', 'nope_uuidv7', nopeUuidV7.opsPerSec)

printResult(cryptoUuid)
printResult(uuidPkgV4)
printResult(lukeedV4Result)
printResult(nopeUuidV4)
printResult(uuidPkgV7)
printResult(nopeUuidV7)

log('\n  \x1b[2mNative crypto.randomUUID() is the fastest for plain v4 UUIDs. If that is all')
log('  you need, use it. nope-id leads the uuid npm package (especially v7) and adds')
log('  many formats (ULID, Snowflake, ObjectId, Sqids, typed IDs) those do not offer.\x1b[0m')

// ============================================
// 5d. vs other ID libraries (same format / same purpose)
// ============================================
log('\n\x1b[1m📊 vs other ID libraries\x1b[0m\n')

const ulidPkgMono = ulidMonoFactory()
const nopeMonoGen = monotonicFactory()

const ulidPkgResult = benchmark('ulid package', () => ulidPkg())
const nopeUlidResult = benchmark('nope-id ulid()', () => ulid())
const ulidPkgMonoResult = benchmark('ulid package (monotonic)', () => ulidPkgMono())
const nopeMonoResult = benchmark('nope-id monotonicFactory', () => nopeMonoGen())
record('ulid', 'ulid_pkg', ulidPkgResult.opsPerSec)
record('ulid', 'nope_ulid', nopeUlidResult.opsPerSec)
record('ulid', 'ulid_pkg_monotonic', ulidPkgMonoResult.opsPerSec)
record('ulid', 'nope_monotonic', nopeMonoResult.opsPerSec)

log('  \x1b[1mULID (26-char Crockford, sortable; identical format):\x1b[0m')
printResult(ulidPkgResult)
printResult(nopeUlidResult)
printResult(ulidPkgMonoResult)
printResult(nopeMonoResult)

const uidResult = benchmark('uid/secure(21) (hex)', () => uid(21))
const rndmResult = benchmark('rndm (Math.random, insecure)', () => rndm(21))
const srsResult = benchmark('secure-random-string', () => srs({ length: 21 }))
const cuid2Result = benchmark('cuid2 createId()', () => cuid2())
const sparkidResult = benchmark('sparkid generateId()', () => sparkidGen())
const nopeidVsOthers = benchmark('nope-id nopeid()', () => nopeid())
record('vs_others', 'uid_secure', uidResult.opsPerSec)
record('vs_others', 'rndm', rndmResult.opsPerSec)
record('vs_others', 'secure_random_string', srsResult.opsPerSec)
record('vs_others', 'cuid2', cuid2Result.opsPerSec)
record('vs_others', 'sparkid', sparkidResult.opsPerSec)
record('vs_others', 'nope_nopeid', nopeidVsOthers.opsPerSec)

log('\n  \x1b[1mOther random string generators:\x1b[0m')
printResult(uidResult)
printResult(rndmResult)
printResult(srsResult)
printResult(cuid2Result)
printResult(sparkidResult)
printResult(nopeidVsOthers)

log('\n  \x1b[2muid/secure is fastest but emits 16-char hex (fewer bits per char). Among')
log('  full-alphabet URL-safe generators nope-id leads nanoid. sparkid is CSPRNG-backed,')
log('  sortable + monotonic Base58, but spends 8/21 chars on a time prefix. rndm uses')
log('  Math.random (insecure); cuid2 throttles on purpose; the ulid package randomizes')
log('  per char.\x1b[0m')

// ============================================
// 6. Batch Generation
// ============================================
log('\n\x1b[1m📊 Batch Generation (100 IDs)\x1b[0m\n')

const nanoidBatch = benchmark('nanoid x100 (loop)', () => {
  const ids = []
  for (let i = 0; i < 100; i++) ids.push(nanoid())
  return ids
})

const nopeidBatch = benchmark('generateMany(100)', () => generateMany(100))
recordComparison('batch_100', nanoidBatch, nopeidBatch)

printResult(nanoidBatch)
printResult(nopeidBatch, nanoidBatch)

// ============================================
// Summary
// ============================================
log('\n' + '═'.repeat(70))
log('  Summary')
log('═'.repeat(70))

const summaryRows = [
  { test: 'Basic (21 chars)', nanoid: nanoidBasic.opsPerSec, nopeid: nopeidBasic.opsPerSec },
  { test: 'Small (10 chars)', nanoid: nanoidSmall.opsPerSec, nopeid: nopeidSmall.opsPerSec },
  { test: 'Large (64 chars)', nanoid: nanoidLarge.opsPerSec, nopeid: nopeidLarge.opsPerSec },
  { test: 'Custom Alphabet', nanoid: nanoidCustom.opsPerSec, nopeid: nopeidCustom.opsPerSec },
  { test: 'Batch (100 IDs)', nanoid: nanoidBatch.opsPerSec, nopeid: nopeidBatch.opsPerSec },
]

log('\n  Test                    nanoid         nope-id       Winner')
log('  ' + '─'.repeat(64))

let nanoidWins = 0
let nopeidWins = 0

summaryRows.forEach(r => {
  const ratio = r.nopeid / r.nanoid
  const winner = ratio >= 1 ? '\x1b[32mnope-id\x1b[0m' : '\x1b[33mnanoid\x1b[0m'
  if (ratio >= 1) nopeidWins++
  else nanoidWins++

  log(
    `  ${r.test.padEnd(22)} ${formatNumber(r.nanoid).padStart(12)} ${formatNumber(r.nopeid).padStart(14)}   ${winner}`
  )
})

log('  ' + '─'.repeat(64))
log(
  `\n  \x1b[1mOverall: nope-id wins ${nopeidWins}/${summaryRows.length} tests\x1b[0m`
)

// Extra features summary
log('\n  \x1b[1mExtra Features (nanoid doesn\'t have):\x1b[0m')
log(`    • sortableId():    ${formatNumber(sortableResult.opsPerSec)} ops/sec`)
log(`    • prefixedId():    ${formatNumber(prefixedResult.opsPerSec)} ops/sec`)
log(`    • uuid():          ${formatNumber(uuidResult.opsPerSec)} ops/sec`)
log(`    • slugId():        ${formatNumber(slugResult.opsPerSec)} ops/sec`)
log(`    • shortId():       ${formatNumber(shortResult.opsPerSec)} ops/sec`)
log(`    • isValid():       ${formatNumber(isValidResult.opsPerSec)} ops/sec`)

log('\n' + '═'.repeat(70) + '\n')

if (JSON_MODE) {
  process.stdout.write(JSON.stringify(results, null, 2) + '\n')
}
