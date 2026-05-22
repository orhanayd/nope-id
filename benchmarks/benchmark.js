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

const TRIALS = 7
const TARGET_MS = 120

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

  console.log(`  ${result.name.padEnd(35)} ${ops.padStart(12)} ops/sec${comparison}`)
}

console.log('\n' + '═'.repeat(70))
console.log('  nope-id vs nanoid - Performance Benchmark')
console.log('═'.repeat(70))
console.log(`  Auto-calibrated ~${TARGET_MS}ms/trial | Best of ${TRIALS} trials | numbers vary by machine`)
console.log('─'.repeat(70))

// Measure native crypto.randomUUID() FIRST. Its throughput drops sharply once other
// CSPRNG-backed generators run in the same process (shared entropy path), so measuring
// it up front gives it a fair, un-depressed number, since we don't want to flatter ourselves
// by under-reporting the fastest tool. (Suggested in issue #4 by nanoid's author.)
const cryptoUuid = benchmark('crypto.randomUUID() (native v4)', () => randomUUID())

// Global warmup so the CPU/JIT is hot before the first timed comparison, since otherwise
// whichever library is measured first is unfairly penalized by a cold start.
for (let i = 0; i < 500000; i++) { nanoid(); nopeid() }

// ============================================
// 1. Basic ID Generation (21 chars)
// ============================================
console.log('\n\x1b[1m📊 Basic ID Generation (21 characters)\x1b[0m\n')

const nanoidBasic = benchmark('nanoid()', () => nanoid())
const nopeidBasic = benchmark('nopeid()', () => nopeid())

printResult(nanoidBasic)
printResult(nopeidBasic, nanoidBasic)

// ============================================
// 2. Custom Size (10 chars)
// ============================================
console.log('\n\x1b[1m📊 Custom Size (10 characters)\x1b[0m\n')

const nanoidSmall = benchmark('nanoid(10)', () => nanoid(10))
const nopeidSmall = benchmark('nopeid(10)', () => nopeid(10))

printResult(nanoidSmall)
printResult(nopeidSmall, nanoidSmall)

// ============================================
// 3. Large Size (64 chars)
// ============================================
console.log('\n\x1b[1m📊 Large Size (64 characters)\x1b[0m\n')

const nanoidLarge = benchmark('nanoid(64)', () => nanoid(64))
const nopeidLarge = benchmark('nopeid(64)', () => nopeid(64))

printResult(nanoidLarge)
printResult(nopeidLarge, nanoidLarge)

// ============================================
// 4. Custom Alphabet
// ============================================
console.log('\n\x1b[1m📊 Custom Alphabet (hex, 16 chars)\x1b[0m\n')

const nanoidHex = nanoidCustomAlphabet('0123456789abcdef', 16)
const nopeidHex = customAlphabet('0123456789abcdef', 16)

const nanoidCustom = benchmark('nanoid customAlphabet', () => nanoidHex())
const nopeidCustom = benchmark('nopeid customAlphabet', () => nopeidHex())

printResult(nanoidCustom)
printResult(nopeidCustom, nanoidCustom)

// ============================================
// 5. nope-id Exclusive Features
// ============================================
console.log('\n\x1b[1m📊 nope-id Exclusive Features\x1b[0m\n')

const sortableResult = benchmark('sortableId()', () => sortableId())
const prefixedResult = benchmark("prefixedId('user')", () => prefixedId('user'))
const uuidResult = benchmark('uuid()', () => uuid())
const slugResult = benchmark('slugId()', () => slugId())
const shortResult = benchmark('shortId()', () => shortId())

printResult(sortableResult)
printResult(prefixedResult)
printResult(uuidResult)
printResult(slugResult)
printResult(shortResult)

// ============================================
// 5b. New ID Types
// ============================================
console.log('\n\x1b[1m📊 New ID Types\x1b[0m\n')

const nextSnowflake = snowflakeFactory({ nodeId: 1 })
const nextMono = monotonicFactory()
const sqidsGen = sqidsFactory()

printResult(benchmark('uuidv7()', () => uuidv7()))
printResult(benchmark('ulid()', () => ulid()))
printResult(benchmark('monotonicFactory next', () => nextMono()))
printResult(benchmark('snowflake (factory)', () => nextSnowflake()))
printResult(benchmark('objectId()', () => objectId()))
printResult(benchmark('sqids encode [1,2,3]', () => sqidsGen.encode([1, 2, 3])))

// ============================================
// 5c. UUID generators vs the `uuid` package and native crypto.randomUUID()
// (suggested by nanoid's author in issue #4; a fair benchmark needs more tools)
// ============================================
console.log('\n\x1b[1m📊 UUID generators (different tools, different trade-offs)\x1b[0m\n')

// cryptoUuid was measured up front (see above) for a fair, un-depressed native number
const uuidPkgV4 = benchmark('uuid v4 (npm)', () => uuidV4())
const nopeUuidV4 = benchmark('nope-id uuid() (v4)', () => uuid())
const uuidPkgV7 = benchmark('uuid v7 (npm)', () => uuidV7())
const nopeUuidV7 = benchmark('nope-id uuidv7()', () => uuidv7())

printResult(cryptoUuid)
printResult(uuidPkgV4)
printResult(nopeUuidV4)
printResult(uuidPkgV7)
printResult(nopeUuidV7)

console.log('\n  \x1b[2mNative crypto.randomUUID() is the fastest for plain v4 UUIDs. If that is all')
console.log('  you need, use it. nope-id leads the uuid npm package (especially v7) and adds')
console.log('  many formats (ULID, Snowflake, ObjectId, Sqids, typed IDs) those do not offer.\x1b[0m')

// ============================================
// 5d. vs other ID libraries (same format / same purpose)
// ============================================
console.log('\n\x1b[1m📊 vs other ID libraries\x1b[0m\n')

const ulidPkgMono = ulidMonoFactory()
const nopeMonoGen = monotonicFactory()

console.log('  \x1b[1mULID (26-char Crockford, sortable; identical format):\x1b[0m')
printResult(benchmark('ulid package', () => ulidPkg()))
printResult(benchmark('nope-id ulid()', () => ulid()))
printResult(benchmark('ulid package (monotonic)', () => ulidPkgMono()))
printResult(benchmark('nope-id monotonicFactory', () => nopeMonoGen()))

console.log('\n  \x1b[1mCollision-resistant string IDs:\x1b[0m')
printResult(benchmark('cuid2 createId()', () => cuid2()))
printResult(benchmark('nope-id nopeid()', () => nopeid()))

console.log('\n  \x1b[2mcuid2 throttles hashing on purpose so collisions/entropy cannot be brute-forced')
console.log('  in parallel; its own README suggests nanoid/ulid for tight loops. The ulid')
console.log('  package fetches randomness per character; nope-id pools it.\x1b[0m')

// ============================================
// 6. Batch Generation
// ============================================
console.log('\n\x1b[1m📊 Batch Generation (100 IDs)\x1b[0m\n')

const nanoidBatch = benchmark('nanoid x100 (loop)', () => {
  const ids = []
  for (let i = 0; i < 100; i++) ids.push(nanoid())
  return ids
})

const nopeidBatch = benchmark('generateMany(100)', () => generateMany(100))

printResult(nanoidBatch)
printResult(nopeidBatch, nanoidBatch)

// ============================================
// Summary
// ============================================
console.log('\n' + '═'.repeat(70))
console.log('  Summary')
console.log('═'.repeat(70))

const results = [
  { test: 'Basic (21 chars)', nanoid: nanoidBasic.opsPerSec, nopeid: nopeidBasic.opsPerSec },
  { test: 'Small (10 chars)', nanoid: nanoidSmall.opsPerSec, nopeid: nopeidSmall.opsPerSec },
  { test: 'Large (64 chars)', nanoid: nanoidLarge.opsPerSec, nopeid: nopeidLarge.opsPerSec },
  { test: 'Custom Alphabet', nanoid: nanoidCustom.opsPerSec, nopeid: nopeidCustom.opsPerSec },
  { test: 'Batch (100 IDs)', nanoid: nanoidBatch.opsPerSec, nopeid: nopeidBatch.opsPerSec },
]

console.log('\n  Test                    nanoid         nope-id       Winner')
console.log('  ' + '─'.repeat(64))

let nanoidWins = 0
let nopeidWins = 0

results.forEach(r => {
  const ratio = r.nopeid / r.nanoid
  const winner = ratio >= 1 ? '\x1b[32mnope-id\x1b[0m' : '\x1b[33mnanoid\x1b[0m'
  if (ratio >= 1) nopeidWins++
  else nanoidWins++

  console.log(
    `  ${r.test.padEnd(22)} ${formatNumber(r.nanoid).padStart(12)} ${formatNumber(r.nopeid).padStart(14)}   ${winner}`
  )
})

console.log('  ' + '─'.repeat(64))
console.log(
  `\n  \x1b[1mOverall: nope-id wins ${nopeidWins}/${results.length} tests\x1b[0m`
)

// Extra features summary
console.log('\n  \x1b[1mExtra Features (nanoid doesn\'t have):\x1b[0m')
console.log(`    • sortableId():    ${formatNumber(sortableResult.opsPerSec)} ops/sec`)
console.log(`    • prefixedId():    ${formatNumber(prefixedResult.opsPerSec)} ops/sec`)
console.log(`    • uuid():          ${formatNumber(uuidResult.opsPerSec)} ops/sec`)
console.log(`    • slugId():        ${formatNumber(slugResult.opsPerSec)} ops/sec`)
console.log(`    • shortId():       ${formatNumber(shortResult.opsPerSec)} ops/sec`)

console.log('\n' + '═'.repeat(70) + '\n')
