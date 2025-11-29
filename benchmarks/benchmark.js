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
} from '../index.js'

const ITERATIONS = 100000
const WARMUP = 1000

// Benchmark utility
const benchmark = (name, fn, iterations = ITERATIONS) => {
  // Warmup
  for (let i = 0; i < WARMUP; i++) fn()

  const start = performance.now()
  for (let i = 0; i < iterations; i++) fn()
  const end = performance.now()

  const duration = end - start
  const opsPerSec = Math.round((iterations / duration) * 1000)

  return { name, duration, iterations, opsPerSec }
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
console.log(`  Iterations: ${formatNumber(ITERATIONS)} | Warmup: ${formatNumber(WARMUP)}`)
console.log('─'.repeat(70))

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
// 6. Batch Generation
// ============================================
console.log('\n\x1b[1m📊 Batch Generation (100 IDs)\x1b[0m\n')

const nanoidBatch = benchmark(
  'nanoid x100 (loop)',
  () => {
    const ids = []
    for (let i = 0; i < 100; i++) ids.push(nanoid())
    return ids
  },
  ITERATIONS / 100
)

const nopeidBatch = benchmark('generateMany(100)', () => generateMany(100), ITERATIONS / 100)

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
