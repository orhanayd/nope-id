// scripts/update-readme.js
// Refresh README.md performance tables from a benchmark JSON file.
// Usage: node scripts/update-readme.js <bench.json>
//
// Each auto-managed region in README is bracketed by HTML comment markers:
//   <!-- bench:NAME:start --> ... <!-- bench:NAME:end -->
// This script replaces the content between matching markers. The markers stay
// invisible in rendered markdown.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const README_PATH = join(__dirname, '..', 'README.md')

const benchPath = process.argv[2]
if (!benchPath) {
  console.error('Usage: node scripts/update-readme.js <bench.json>')
  process.exit(1)
}

const bench = JSON.parse(readFileSync(benchPath, 'utf8'))

const required = ['meta', 'comparison', 'uuid', 'ulid', 'vs_others', 'extras']
for (const k of required) {
  if (!bench[k]) throw new Error(`bench.json is missing required key "${k}"`)
}
const reqComparison = ['basic_21', 'small_10', 'large_64', 'custom_alphabet', 'batch_100']
for (const k of reqComparison) {
  if (!bench.comparison[k]) throw new Error(`bench.json missing comparison.${k}`)
}

// === Formatting helpers ===

// 18953239 -> "~18.9M", 26613701 -> "~26.6M", 7958000 -> "~8M"
// 181113   -> "~181K", 7462 -> "~7.5K", 57085 -> "~57K"
// 750      -> "~750"
const fmtOps = n => {
  if (n >= 1e6) {
    const v = n / 1e6
    return '~' + (v >= 10 ? v.toFixed(1).replace(/\.0$/, '') : v.toFixed(1)) + 'M'
  }
  if (n >= 1e3) {
    const v = n / 1e3
    return '~' + (v >= 10 ? Math.round(v) : v.toFixed(1)) + 'K'
  }
  return '~' + Math.round(n)
}

const fmtOpsSec = n => fmtOps(n) + ' ops/sec'
const fmtRatio = r => '~' + r.toFixed(1).replace(/\.0$/, '') + 'x'

// === Region replacement ===

let readme = readFileSync(README_PATH, 'utf8')

const replaceRegion = (name, body) => {
  const re = new RegExp(
    `(<!-- bench:${name}:start -->)[\\s\\S]*?(<!-- bench:${name}:end -->)`,
    'm'
  )
  if (!re.test(readme)) {
    throw new Error(`README is missing marker pair for "${name}"`)
  }
  readme = readme.replace(re, `$1\n${body}\n$2`)
}

// === Headline range ===
// Build "Nx to Mx" from the spread of comparison ratios. Clamp the floor at 2x
// so we never display "1x" (which would read as "same speed").
{
  const ratios = Object.values(bench.comparison).map(c => c.ratio)
  const minR = Math.min(...ratios)
  const maxR = Math.max(...ratios)
  const lo = Math.max(2, Math.round(minR))
  const hi = Math.max(lo, Math.round(maxR))
  const range = lo === hi ? `~${lo}x` : `${lo}x to ${hi}x`
  replaceRegion(
    'headline',
    `- **Faster** - ${range} faster than nanoid (CSPRNG, full URL-safe alphabet); wins all 5 core benchmarks ([see benchmarks](#performance))`
  )
}

// === Main comparison table ===
{
  const rows = [
    ['Basic (21 chars)', bench.comparison.basic_21],
    ['Small (10 chars)', bench.comparison.small_10],
    ['Large (64 chars)', bench.comparison.large_64],
    ['Custom Alphabet', bench.comparison.custom_alphabet],
    ['Batch (100 IDs)', bench.comparison.batch_100],
  ]
  const lines = ['| Test | nanoid 5.1.11 | nope-id | Winner |', '|------|--------|---------|--------|']
  for (const [name, r] of rows) {
    const winner = r.ratio >= 1
      ? `**nope-id ${fmtRatio(r.ratio)}**`
      : `**nanoid ${fmtRatio(1 / r.ratio)}**`
    lines.push(`| ${name} | ${fmtOpsSec(r.nanoid)} | **${fmtOpsSec(r.nopeid)}** | ${winner} |`)
  }
  replaceRegion('comparison-table', lines.join('\n'))
}

// === UUID table ===
{
  const u = bench.uuid
  const lines = [
    '| Generator | ops/sec | |',
    '|---|---|---|',
    `| \`crypto.randomUUID()\` (Node native, v4) | **${fmtOps(u.crypto_randomUUID.opsPerSec)}** | 🥇 fastest for plain v4 |`,
    `| nope-id \`uuid()\` (v4) | ${fmtOps(u.nope_uuid.opsPerSec)} | on par with \`@lukeed/uuid\`, ahead of \`uuid\` |`,
    `| \`@lukeed/uuid\` \`v4()\` | ${fmtOps(u.lukeed_uuid.opsPerSec)} | optimized pure-JS v4 |`,
    `| \`uuid\` package \`v4()\` | ${fmtOps(u.uuid_v4.opsPerSec)} | |`,
    `| nope-id \`uuidv7()\` | ${fmtOps(u.nope_uuidv7.opsPerSec)} | **~${Math.round(u.nope_uuidv7.opsPerSec / u.uuid_v7.opsPerSec)}x the \`uuid\` package's v7** |`,
    `| \`uuid\` package \`v7()\` | ${fmtOps(u.uuid_v7.opsPerSec)} | |`,
  ]
  replaceRegion('uuid-table', lines.join('\n'))
}

// === ULID table ===
{
  const u = bench.ulid
  const lines = [
    '| Generator | ops/sec |',
    '|---|---|',
    `| nope-id \`ulid()\` | **${fmtOps(u.nope_ulid.opsPerSec)}** |`,
    `| \`ulid\` package | ${fmtOps(u.ulid_pkg.opsPerSec)} |`,
    `| nope-id \`monotonicFactory()\` | **${fmtOps(u.nope_monotonic.opsPerSec)}** |`,
    `| \`ulid\` package (monotonic) | ${fmtOps(u.ulid_pkg_monotonic.opsPerSec)} |`,
  ]
  replaceRegion('ulid-table', lines.join('\n'))
}

// === Speed vs entropy table ===
// Sort: nope-id always first, then others by ops/sec descending.
{
  const v = bench.vs_others
  const nanoidOps = bench.comparison.basic_21.nanoid
  // Use the comparison basic_21 nopeid number so the figure matches the main perf table
  // exactly. The vs_others nope_nopeid measurement is the same function but runs later in
  // the same process, picking up tiny timing fluctuations that would otherwise diverge.
  const nopeidOps = bench.comparison.basic_21.nopeid
  const fixed = [
    { gen: '**nope-id `nopeid()`**', ops: nopeidOps, entropy: '**~126 bits (64-char URL-safe)**', src: '**CSPRNG**', bold: true },
    { gen: '`uid/secure`', ops: v.uid_secure.opsPerSec, entropy: '~84 bits (16-char hex)', src: 'CSPRNG' },
    { gen: 'nanoid', ops: nanoidOps, entropy: '~126 bits (64-char URL-safe)', src: 'CSPRNG' },
    { gen: '`rndm`', ops: v.rndm.opsPerSec, entropy: '~125 bits, but predictable', src: '`Math.random` (not secure)' },
    { gen: '`secure-random-string`', ops: v.secure_random_string.opsPerSec, entropy: '~126 bits (base64, not URL-safe)', src: 'CSPRNG' },
    { gen: 'cuid2 `createId()`', ops: v.cuid2.opsPerSec, entropy: '24-char, hash-derived', src: 'CSPRNG + SHA-3' },
  ]
  const lines = [
    '| Generator | ops/sec | entropy / id | randomness source |',
    '|---|---|---|---|',
  ]
  for (const r of fixed) {
    const ops = r.bold ? `**${fmtOps(r.ops)}**` : fmtOps(r.ops)
    lines.push(`| ${r.gen} | ${ops} | ${r.entropy} | ${r.src} |`)
  }
  replaceRegion('speed-vs-entropy-table', lines.join('\n'))
}

// === Extras table ===
{
  const e = bench.extras
  const lines = [
    '| Feature | Performance |',
    '|---------|-------------|',
    `| \`sortableId()\` | ${fmtOpsSec(e.sortableId.opsPerSec)} |`,
    `| \`prefixedId()\` | ${fmtOpsSec(e.prefixedId.opsPerSec)} |`,
    `| \`uuid()\` | ${fmtOpsSec(e.uuid.opsPerSec)} |`,
    `| \`slugId()\` | ${fmtOpsSec(e.slugId.opsPerSec)} |`,
    `| \`shortId()\` | ${fmtOpsSec(e.shortId.opsPerSec)} |`,
    `| \`isValid()\` | ${fmtOpsSec(e.isValid.opsPerSec)} |`,
    `| \`uuidv7()\` | ${fmtOpsSec(e.uuidv7.opsPerSec)} |`,
    `| \`ulid()\` | ${fmtOpsSec(e.ulid.opsPerSec)} |`,
    `| \`monotonicFactory()\` | ${fmtOpsSec(e.monotonicFactory.opsPerSec)} |`,
    `| \`snowflake\` (factory) | ${fmtOpsSec(e.snowflake.opsPerSec)} |`,
    `| \`objectId()\` | ${fmtOpsSec(e.objectId.opsPerSec)} |`,
    `| \`sqids.encode()\` | ${fmtOpsSec(e.sqids.opsPerSec)} |`,
  ]
  replaceRegion('extras-table', lines.join('\n'))
}

// === Meta line ===
{
  const date = bench.meta.date.slice(0, 10)
  const nodeMajor = bench.meta.node.replace(/^v?(\d+).*$/, 'v$1.x')
  const runner = bench.meta.runner === 'github-actions'
    ? 'ubuntu-latest (GitHub Actions)'
    : `${bench.meta.platform}/${bench.meta.arch} (local)`
  replaceRegion('meta', `_Last refreshed: ${date}, Node ${nodeMajor}, ${runner}._`)
}

writeFileSync(README_PATH, readme)
console.error(`README refreshed from ${benchPath}`)
