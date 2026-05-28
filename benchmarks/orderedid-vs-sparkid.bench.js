// 15-trial head-to-head: nope-id orderedId() vs sparkid generateId().
// Best-of-N ops/sec at a fixed ~120ms window, both in the same warmed
// process. Prints per-trial winner, win counts, median ratio, mean
// ratio — feeds the README's benchmarks-policy clause.

import { orderedId } from '../index.js'
import { generateId as sparkidGen } from 'sparkid'

const TRIALS = 15
const TARGET_MS = 120

const bench = fn => {
  let calIters = 2000
  let calMs = 0
  while (calMs < 5) {
    const start = performance.now()
    for (let i = 0; i < calIters; i++) fn()
    calMs = performance.now() - start
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
  return best
}

const fmt = n => n.toLocaleString().padStart(13)

// Warmup so both functions hit V8 steady-state before the head-to-head
for (let i = 0; i < 500000; i++) { orderedId(); sparkidGen() }

console.log('═'.repeat(64))
console.log('  orderedId() vs sparkid generateId() — 15-trial head-to-head')
console.log('═'.repeat(64))
console.log()
console.log('  trial    orderedId        sparkid    ratio       winner')
console.log('  ' + '─'.repeat(58))

const ratios = []
let orderedWins = 0
let sparkidWins = 0

for (let i = 0; i < TRIALS; i++) {
  // Each trial is its own best-of-N micro-benchmark so a single bad
  // sample (GC pause, schedule blip) only affects one ratio.
  const o = bench(() => orderedId())
  const s = bench(() => sparkidGen())
  const ratio = o / s
  ratios.push(ratio)
  const winner = o > s ? 'orderedId' : 'sparkid'
  if (o > s) orderedWins++; else sparkidWins++
  console.log(
    `   ${String(i + 1).padStart(2)}    ${fmt(o)}    ${fmt(s)}    ${ratio.toFixed(3)}x   ${winner}`
  )
}

const sorted = [...ratios].sort((a, b) => a - b)
const median = sorted[Math.floor(sorted.length / 2)]
const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length

console.log('  ' + '─'.repeat(58))
console.log()
console.log(`  orderedId wins: ${orderedWins}/${TRIALS}    sparkid wins: ${sparkidWins}/${TRIALS}`)
console.log(`  median ratio:   ${median.toFixed(3)}x`)
console.log(`  mean ratio:     ${mean.toFixed(3)}x`)
console.log()
if (orderedWins >= 12 && median >= 1.03) {
  console.log('  VERDICT: orderedId clearly ahead — keep "small edge" wording.')
} else if (orderedWins >= 8 && median >= 1.01) {
  console.log('  VERDICT: marginal edge — soften wording to "small/marginal edge".')
} else {
  console.log('  VERDICT: tied within noise — switch wording to "comparable performance".')
}
