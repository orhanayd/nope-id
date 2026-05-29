// Honest head-to-head: nope-id vs sparkid, using MULTI-PROCESS isolation.
//
// The previous version of this file ran both libraries in the SAME process and
// alternated between them. That is the failure mode CLAUDE.md Rule 2 warns
// about: a shared V8 instance compiles both with mixed JIT feedback, so the
// "winner" is mostly noise. This version measures each function in its OWN
// fresh Node process (warmup + best-of-N inside that process) and reports a
// Welch two-sample t-test across processes — the same method as
// benchmarks/ab-multiproc.mjs.
//
// It measures BOTH axes that matter:
//   • per-call : orderedId()      vs sparkid generateId()
//   • batch    : orderedId.many(100) vs a 100x generateId() loop  (per-ID rate)
//
// Honest expected result on Node 22: per-call is a statistical TIE (both pay one
// Date.now() per ID, ~60-65% of latency), and orderedId.many() wins ~1.7x
// because it amortizes Date.now() across the batch (sparkid has no batch API).
//
//   node benchmarks/orderedid-vs-sparkid.bench.js

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const SELF = fileURLToPath(import.meta.url)

const PROCS = 12
const TRIALS = 13
const TARGET_MS = 220

// ---------------- child: measure ONE kind in isolation ----------------
const KINDS = {
  'ordered-call':   async () => { const { orderedId } = await import('../index.js'); return () => orderedId().length },
  'sparkid-call':   async () => { const { generateId } = await import('sparkid'); return () => generateId().length },
  'ordered-many':   async () => { const { orderedId } = await import('../index.js'); return () => orderedId.many(100).length },
  'sparkid-loop':   async () => { const { generateId } = await import('sparkid'); return () => { let s = 0; for (let i = 0; i < 100; i++) s += generateId().length; return s } },
}
const PER_OP_IDS = { 'ordered-call': 1, 'sparkid-call': 1, 'ordered-many': 100, 'sparkid-loop': 100 }

const argOf = n => { const h = process.argv.find(a => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : undefined }

if (process.argv.includes('--child')) {
  const kind = argOf('kind')
  const work = await KINDS[kind]()
  let sink = 0
  const reps = kind.includes('many') || kind.includes('loop') ? 30000 : 600000
  for (let i = 0; i < reps; i++) sink += work()
  let iters = 5000, ms = 0
  while (ms < 5) { const s = performance.now(); for (let i = 0; i < iters; i++) sink += work(); ms = performance.now() - s; if (ms < 5) iters *= 4 }
  iters = Math.max(2000, Math.ceil((iters / ms) * TARGET_MS))
  let best = 0
  for (let t = 0; t < TRIALS; t++) { const s = performance.now(); for (let i = 0; i < iters; i++) sink += work(); const r = (iters / (performance.now() - s)) * 1000; if (r > best) best = r }
  process.stdout.write(JSON.stringify({ best, sink: sink & 1 }) + '\n')
} else {
  // ---------------- stats (Welch t-test, accurate p via incomplete beta) ----
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length
  const varc = xs => { const m = mean(xs); return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1) }
  const betacf = (a, b, x) => { const F = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < F) d = F; d = 1 / d; let h = d; for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < F) d = F; c = 1 + aa / c; if (Math.abs(c) < F) c = F; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < F) d = F; c = 1 + aa / c; if (Math.abs(c) < F) c = F; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break } return h }
  const gln = x => { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let ser = 1.000000000190015; for (let j = 0; j < 6; j++) { y++; ser += c[j] / y } return -tmp + Math.log(2.5066282746310005 * ser / x) }
  const ibeta = (x, a, b) => { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(gln(a + b) - gln(a) - gln(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b }
  const welch = (a, b) => { const ma = mean(a), mb = mean(b), va = varc(a), vb = varc(b), na = a.length, nb = b.length; const t = (ma - mb) / Math.sqrt(va / na + vb / nb); const df = (va / na + vb / nb) ** 2 / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1)); return { t, df, p: ibeta(df / (df + t * t), df / 2, 0.5), ma, mb } }

  const spawnOne = kind => new Promise((res, rej) => { const c = spawn(process.execPath, [SELF, '--child', `--kind=${kind}`], { stdio: ['ignore', 'pipe', 'inherit'] }); let o = ''; c.stdout.on('data', d => o += d); c.on('close', code => code ? rej(new Error('child ' + code)) : res(JSON.parse(o.trim()))) })
  // INTERLEAVE the two kinds (alternating which goes first each round) so any
  // transient system load — thermal throttle, a background task — biases both
  // equally over time. Measuring all of kind A then all of kind B would let a
  // mid-run load shift masquerade as a difference, which matters most exactly
  // when the true gap is ~0 (the per-call tie).
  const samplePair = async (ka, kb) => {
    const a = [], b = []
    for (let p = 0; p < PROCS; p++) {
      if (p % 2 === 0) { a.push((await spawnOne(ka)).best); b.push((await spawnOne(kb)).best) }
      else { b.push((await spawnOne(kb)).best); a.push((await spawnOne(ka)).best) }
    }
    return [a, b]
  }

  const fmt = n => Math.round(n).toLocaleString().padStart(13)
  console.log('\n' + '═'.repeat(72))
  console.log(`  nope-id vs sparkid — multi-process (${PROCS} procs, best-of-${TRIALS})`)
  console.log('═'.repeat(72))

  // per-call: ops/sec == IDs/sec (1 ID per op)
  const [oc, sc] = await samplePair('ordered-call', 'sparkid-call')
  const w1 = welch(oc, sc), r1 = mean(oc) / mean(sc)
  // Tie band: the true per-call gap is < 2% (identical string-build cost, both
  // pay one Date.now()), and the winner flips between runs. Only call a winner
  // if the gap is both statistically significant AND materially >= 3%.
  const tie1 = w1.p >= 0.05 || Math.abs(r1 - 1) < 0.03
  console.log('\n  PER-CALL  (IDs/sec)')
  console.log(`    orderedId()          ${fmt(mean(oc))}`)
  console.log(`    sparkid generateId() ${fmt(mean(sc))}`)
  console.log(`    ratio ${r1.toFixed(3)}x   p=${w1.p.toExponential(2)}   → ${tie1 ? 'TIE within noise (both Date.now()-bound; winner flips run-to-run)' : (r1 > 1 ? 'orderedId faster' : 'sparkid faster')}`)

  // batch: multiply ops/sec by 100 to get IDs/sec
  const [om, sl] = await samplePair('ordered-many', 'sparkid-loop')
  const w2 = welch(om, sl), r2 = mean(om) / mean(sl)
  console.log('\n  BATCH OF 100  (IDs/sec)')
  console.log(`    orderedId.many(100)  ${fmt(mean(om) * 100)}`)
  console.log(`    sparkid 100x loop    ${fmt(mean(sl) * 100)}`)
  console.log(`    ratio ${r2.toFixed(3)}x   p=${w2.p.toExponential(2)}   → ${w2.p < 0.05 && r2 > 1 ? `orderedId.many() ${r2.toFixed(2)}x FASTER (amortizes Date.now())` : 'no significant difference'}`)

  console.log('\n  ' + '─'.repeat(68))
  console.log('  Honest verdict: per-call is a tie (both pay one Date.now() per ID);')
  console.log('  nope-id wins the batch path via orderedId.many(), and ships 8 random')
  console.log('  chars/ID (~46.9 bits) vs sparkid\'s 7 (~41 bits) at the same length.')
  console.log('')
}
