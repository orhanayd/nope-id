// Multi-process A/B harness (CLAUDE.md Rule 2).
//
// Each variant is measured in its OWN fresh Node process — no shared V8
// instance, so the JIT compiles each variant with clean, unmixed feedback.
// Each child does warmup + best-of-N inside its own process and reports a
// single number (its best ops/sec). The parent spawns P children per variant,
// collects the P per-process samples, and runs a Welch two-sample t-test for
// each non-baseline variant against the baseline.
//
// Usage (parent):
//   node benchmarks/ab-multiproc.mjs <specfile.json>
// where specfile.json = { procs, target, trials, op, variants:[{label,module,export}] }
// The FIRST variant is the baseline; every other is tested against it.
//
// Child mode (spawned internally):
//   node benchmarks/ab-multiproc.mjs --child --module=PATH --export=NAME \
//        --op=call --target=MS --trials=K

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SELF = fileURLToPath(import.meta.url)

// ---------- child ----------
const arg = name => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

async function runChild() {
  const modulePath = arg('module')
  const exportName = arg('export')
  const op = arg('op') || 'call'
  const target = Number(arg('target') || 200)
  const trials = Number(arg('trials') || 15)

  const mod = await import(modulePath)
  const fn = mod[exportName]
  if (typeof fn !== 'function') {
    console.error(`export ${exportName} is not a function in ${modulePath}`)
    process.exit(2)
  }

  // The measured operation. We touch .length so V8 cannot dead-code the result.
  let sink = 0
  let work
  if (op.startsWith('many')) {
    const n = Number(op.slice(4)) || 100
    work = () => { const a = fn(n); sink += a.length }
  } else {
    work = () => { sink += fn().length }
  }

  // Warmup — push V8 to steady state for THIS process's single function.
  // Scale by batch size: a fixed batch-call count would warm up
  // (count * n) IDs and explode for large n, so target a fixed ~2M IDs.
  const warmupReps = op.startsWith('many')
    ? Math.max(300, Math.ceil(2_000_000 / (Number(op.slice(4)) || 100)))
    : 600000
  for (let i = 0; i < warmupReps; i++) work()

  // Auto-calibrate iteration count to ~target ms.
  let iters = 5000
  let ms = 0
  while (ms < 5) {
    const s = performance.now()
    for (let i = 0; i < iters; i++) work()
    ms = performance.now() - s
    if (ms < 5) iters *= 4
  }
  iters = Math.max(5000, Math.ceil((iters / ms) * target))

  let best = 0
  const all = []
  for (let t = 0; t < trials; t++) {
    const s = performance.now()
    for (let i = 0; i < iters; i++) work()
    const rate = (iters / (performance.now() - s)) * 1000
    all.push(rate)
    if (rate > best) best = rate
  }
  // Report best (per CLAUDE.md) plus median for cross-checking.
  all.sort((a, b) => a - b)
  const median = all[all.length >> 1]
  process.stdout.write(JSON.stringify({ best, median, iters, sink: sink & 1 }) + '\n')
}

// ---------- stats ----------
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length
const variance = xs => {
  const m = mean(xs)
  return xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1)
}
const stdev = xs => Math.sqrt(variance(xs))

// Regularized incomplete beta I_x(a,b) via Lentz's continued fraction
// (Numerical Recipes). Used for an accurate Student-t two-tailed p-value.
function betacf(a, b, x) {
  const FPMIN = 1e-300
  let qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c; h *= del
    if (Math.abs(del - 1) < 3e-12) break
  }
  return h
}
function gammaln(x) {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x, tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) { y++; ser += cof[j] / y }
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}
function ibeta(x, a, b) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) +
    a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2)
    ? (bt * betacf(a, b, x)) / a
    : 1 - (bt * betacf(b, a, 1 - x)) / b
}
// Two-tailed p-value for Student-t with df degrees of freedom.
function tTwoTailedP(t, df) {
  const x = df / (df + t * t)
  return ibeta(x, df / 2, 0.5)
}
// Welch's t-test between two samples.
function welch(a, b) {
  const ma = mean(a), mb = mean(b)
  const va = variance(a), vb = variance(b)
  const na = a.length, nb = b.length
  const se = Math.sqrt(va / na + vb / nb)
  const t = (ma - mb) / se
  const df = (va / na + vb / nb) ** 2 /
    ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1))
  const p = tTwoTailedP(t, df)
  return { t, df, p, ma, mb }
}

// ---------- parent ----------
function spawnChild(variant, op, target, trials) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      SELF, '--child',
      `--module=${variant.module}`,
      `--export=${variant.export}`,
      `--op=${op}`,
      `--target=${target}`,
      `--trials=${trials}`,
    ], { stdio: ['ignore', 'pipe', 'inherit'] })
    let out = ''
    child.stdout.on('data', d => { out += d })
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`child exited ${code}`))
      try { resolve(JSON.parse(out.trim())) } catch (e) { reject(e) }
    })
  })
}

async function runParent() {
  const specPath = process.argv[2]
  const spec = JSON.parse(readFileSync(specPath, 'utf8'))
  const procs = spec.procs || 12
  const target = spec.target || 200
  const trials = spec.trials || 15
  const op = spec.op || 'call'

  const fmt = n => Math.round(n).toLocaleString().padStart(14)
  console.log('\n' + '═'.repeat(78))
  console.log(`  multi-process A/B   op=${op}   procs=${procs}   trials/proc=${trials}   target=${target}ms`)
  console.log('═'.repeat(78))

  const results = []
  for (const v of spec.variants) {
    // Interleave is overkill across processes; run all P procs for a variant.
    // Each process is independent, so ordering does not contaminate the JIT.
    const samples = []
    for (let p = 0; p < procs; p++) {
      const r = await spawnChild(v, op, target, trials)
      samples.push(r.best)
    }
    results.push({ ...v, samples })
    console.log(`\n  ${v.label}`)
    console.log(`    best/proc: ${samples.map(s => Math.round(s / 1e6) + 'M').join(' ')}`)
    console.log(`    mean ${fmt(mean(samples))}  median ${fmt([...samples].sort((a, b) => a - b)[samples.length >> 1])}  sd ${fmt(stdev(samples))}  cv ${(100 * stdev(samples) / mean(samples)).toFixed(1)}%`)
  }

  const base = results[0]
  console.log('\n' + '─'.repeat(78))
  console.log(`  Welch t-test vs baseline "${base.label}" (mean ${fmt(mean(base.samples))} ops/sec)`)
  console.log('─'.repeat(78))
  for (let i = 1; i < results.length; i++) {
    const v = results[i]
    const w = welch(v.samples, base.samples)
    const ratio = w.ma / w.mb
    const dir = ratio >= 1 ? 'faster' : 'slower'
    const sig = w.p < 0.01 ? '***' : w.p < 0.05 ? '*  ' : '   '
    const verdict = w.p < 0.05
      ? (ratio >= 1 ? 'SIGNIFICANT WIN' : 'SIGNIFICANT REGRESSION')
      : 'no significant difference'
    console.log(`  ${v.label}`)
    console.log(`    ${(ratio).toFixed(4)}x (${((ratio - 1) * 100).toFixed(2)}% ${dir})   p=${w.p.toExponential(2)} ${sig}  df=${w.df.toFixed(1)}   → ${verdict}`)
  }
  console.log('')
}

if (process.argv.includes('--child')) runChild()
else runParent()
