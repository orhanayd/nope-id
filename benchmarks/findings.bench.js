// Before/after micro-benchmark for the Findings #1, #2, #3 fixes.
// Imports the snapshot of index.js taken before the changes from /tmp/old-index.mjs
// and the current index.js, then runs the same workload against both in the same
// process. Numbers are best-of-N at a fixed ~120 ms window, like benchmarks/benchmark.js.

import * as oldMod from '/tmp/old-index.mjs'
import * as newMod from '../index.js'

const TRIALS = 7
const TARGET_MS = 120

const bench = (label, fn) => {
  let calIters = 2000
  let calMs = 0
  while (calMs < 5) {
    const t = performance.now()
    for (let i = 0; i < calIters; i++) fn()
    calMs = performance.now() - t
    if (calMs < 5) calIters *= 4
  }
  const iters = Math.max(2000, Math.ceil((calIters / calMs) * TARGET_MS))
  let best = 0
  for (let t = 0; t < TRIALS; t++) {
    const start = performance.now()
    for (let i = 0; i < iters; i++) fn()
    const rate = Math.round((iters / (performance.now() - start)) * 1000)
    if (rate > best) best = rate
  }
  return { label, opsPerSec: best }
}

const fmt = n => n.toLocaleString()
const pct = (newOps, oldOps) => {
  const ratio = newOps / oldOps
  return ratio >= 1
    ? `\x1b[32m${ratio.toFixed(2)}x faster\x1b[0m`
    : `\x1b[31m${(1 / ratio).toFixed(2)}x slower\x1b[0m`
}

// Warmup so V8 has the same JIT state for both modules
for (let i = 0; i < 200000; i++) { oldMod.nopeid(); newMod.nopeid() }

// Fixed sample IDs so both versions see identical input
const sampleId = newMod.nopeid()
const sampleIds = []
for (let i = 0; i < 100; i++) sampleIds.push(newMod.nopeid())

console.log('\n' + '═'.repeat(70))
console.log('  Findings #1, #2, #3 — before/after benchmark')
console.log('═'.repeat(70))

const rows = []
const compare = (label, oldFn, newFn) => {
  const o = bench(label + ' (old)', oldFn)
  const n = bench(label + ' (new)', newFn)
  rows.push({ label, oldOps: o.opsPerSec, newOps: n.opsPerSec })
}

// === Finding #1: isValid ===
compare('isValid(default urlAlphabet)', () => oldMod.isValid(sampleId), () => newMod.isValid(sampleId))
compare('isValid(custom alphabet)',
  () => oldMod.isValid(sampleId, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'),
  () => newMod.isValid(sampleId, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_')
)

// === Finding #2: slugId / shortId ===
compare('slugId() default 12', () => oldMod.slugId(), () => newMod.slugId())
compare('slugId(20)  non-default', () => oldMod.slugId(20), () => newMod.slugId(20))
compare('shortId() default 8', () => oldMod.shortId(), () => newMod.shortId())
compare('shortId(16) non-default', () => oldMod.shortId(16), () => newMod.shortId(16))

// === Finding #3: sortableId / monotonicFactory (new-ms path is rare; we hit it once)
// Most calls hit the same-ms increment path, so the Array.from change rarely fires.
// Still measure to confirm no regression.
compare('sortableId()', () => oldMod.sortableId(), () => newMod.sortableId())
const oldMono = oldMod.monotonicFactory()
const newMono = newMod.monotonicFactory()
compare('monotonicFactory.next', () => oldMono(), () => newMono())

// === Print table ===
console.log()
console.log(`  ${'Test'.padEnd(36)} ${'old'.padStart(14)} ${'new'.padStart(14)}    delta`)
console.log('  ' + '─'.repeat(82))
for (const r of rows) {
  console.log(
    `  ${r.label.padEnd(36)} ${fmt(r.oldOps).padStart(14)} ${fmt(r.newOps).padStart(14)}    ${pct(r.newOps, r.oldOps)}`
  )
}
console.log()
