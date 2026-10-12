// Quick snapshot-vs-current micro-benchmark for exploring a change to index.js.
//
//   cp index.js /tmp/old.mjs                      # snapshot before editing
//   node benchmarks/findings.bench.js [snapshot]  # default snapshot: /tmp/old.mjs
//
// Both modules run the same workload in ONE process, so mixed JIT feedback can
// skew the result (CLAUDE.md Rule 2): use it to explore, and accept a change
// only after a multi-process Welch run with benchmarks/ab-multiproc.mjs.
// Numbers are best-of-N at a fixed ~120 ms window, like benchmarks/benchmark.js.

import { pathToFileURL } from 'node:url'
import * as newMod from '../index.js'

const oldMod = await import(pathToFileURL(process.argv[2] || '/tmp/old.mjs').href)

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

// Fixed sample ID so both versions validate identical input
const sampleId = newMod.nopeid()

console.log('\n' + '═'.repeat(70))
console.log('  snapshot vs current index.js (same process)')
console.log('═'.repeat(70))

const rows = []
const compare = (label, oldFn, newFn) => {
  const o = bench(label + ' (snapshot)', oldFn)
  const n = bench(label + ' (current)', newFn)
  rows.push({ label, oldOps: o.opsPerSec, newOps: n.opsPerSec })
}

compare('nopeid()', () => oldMod.nopeid(), () => newMod.nopeid())
compare('isValid(default urlAlphabet)', () => oldMod.isValid(sampleId), () => newMod.isValid(sampleId))
compare('isValid(custom alphabet)',
  () => oldMod.isValid(sampleId, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'),
  () => newMod.isValid(sampleId, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_')
)
compare('slugId()', () => oldMod.slugId(), () => newMod.slugId())
compare('shortId()', () => oldMod.shortId(), () => newMod.shortId())
compare('sortableId()', () => oldMod.sortableId(), () => newMod.sortableId())
const oldMono = oldMod.monotonicFactory()
const newMono = newMod.monotonicFactory()
compare('monotonicFactory()()', () => oldMono(), () => newMono())

console.log()
console.log(`  ${'Test'.padEnd(36)} ${'snapshot'.padStart(14)} ${'current'.padStart(14)}    delta`)
console.log('  ' + '─'.repeat(82))
for (const r of rows) {
  console.log(
    `  ${r.label.padEnd(36)} ${fmt(r.oldOps).padStart(14)} ${fmt(r.newOps).padStart(14)}    ${pct(r.newOps, r.oldOps)}`
  )
}
console.log()
