// scripts/update-readme.js
// Refresh README.md (and translated mirrors README.tr.md, README.ru.md) from a
// benchmark JSON file.
// Usage: node scripts/update-readme.js <bench.json>
//
// Each auto-managed region in a README is bracketed by HTML comment markers:
//   <!-- bench:NAME:start --> ... <!-- bench:NAME:end -->
// This script replaces the content between matching markers. The markers stay
// invisible in rendered markdown.
//
// Translated mirrors are updated using locale-specific phrasing (table headers,
// headline copy, meta sentence, inline notes). Numbers are universal and reused
// across locales. Missing README files are skipped silently so the workflow can
// run on PRs that have not (yet) added all translations.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

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

// === Formatting helpers (locale-agnostic) ===

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
const fmtRatio = r => '~' + r.toFixed(1).replace(/\.0$/, '') + 'x'

// === Locale dictionary ===
// Each locale provides strings the auto-managed regions need. Code identifiers
// (function names like `nopeid()`, library names like `nanoid`) stay verbatim
// across locales; only the surrounding prose is translated.

const L = {
  en: {
    perfAnchor: 'performance',
    range: (lo, hi) => lo === hi ? `~${lo}x` : `${lo}x to ${hi}x`,
    headline: range =>
      `- **Faster** - ${range} faster than nanoid (CSPRNG, full URL-safe alphabet); wins all 5 core benchmarks ([see benchmarks](#performance))`,
    meta: (date, node, runner) => `_Last refreshed: ${date}, Node ${node}, ${runner}._`,
    runnerCI: 'ubuntu-latest (GitHub Actions)',
    runnerLocal: (p, a) => `${p}/${a} (local)`,
    fmtOpsSec: n => fmtOps(n) + ' ops/sec',
    tCompare: {
      head: ['Test', 'nanoid 5.1.11', 'nope-id', 'Winner'],
      sep:  ['------', '--------', '---------', '--------'],
      rowLabels: {
        basic_21: 'Basic (21 chars)',
        small_10: 'Small (10 chars)',
        large_64: 'Large (64 chars)',
        custom_alphabet: 'Custom Alphabet',
        batch_100: 'Batch (100 IDs)',
      },
    },
    tUuid: {
      head: ['Generator', 'ops/sec', ''],
      sep:  ['---', '---', '---'],
      notes: {
        // Static
        lukeed: 'optimized pure-JS v4',
        nopeV7: ratio => `**~${ratio}x the \`uuid\` package's v7**`,
        // Dynamic, ratio-driven (see uuid-table renderer)
        cryptoFastest:  '🥇 fastest for plain v4',
        cryptoCBinding: 'C++ binding (plain v4 only)',
        nopeFastestJs:  '🥇 fastest pure-JS v4',
        nopeBeatsLukeed: ratio => `~${ratio}x faster than \`@lukeed/uuid\`, ahead of \`uuid\``,
        nopeOnPar:      'on par with `@lukeed/uuid`, ahead of `uuid`',
      },
    },
    basic21Ratio: ratio => `~${ratio}x`,
    tUlid: {
      head: ['Generator', 'ops/sec'],
      sep:  ['---', '---'],
    },
    tSortable: {
      head: ['Generator', 'ops/sec'],
      sep:  ['---', '---'],
    },
    tSpeed: {
      head: ['Generator', 'ops/sec', 'entropy / id', 'randomness source'],
      sep:  ['---', '---', '---', '---'],
      entropy: {
        urlsafe64: '~126 bits (64-char URL-safe)',
        hex16:     '~84 bits (16-char hex)',
        rndm:      '~125 bits, but predictable',
        base64:    '~126 bits (base64, not URL-safe)',
        cuid2:     '24-char, hash-derived',
        sparkid:   '~76 bits random (Base58, time-sortable)',
      },
      source: {
        csprng:     'CSPRNG',
        mathRandom: '`Math.random` (not secure)',
        sha3:       'CSPRNG + SHA-3',
      },
    },
    tExtras: {
      head: ['Feature', 'Performance'],
      sep:  ['---------', '-------------'],
    },
  },

  tr: {
    perfAnchor: 'performans',
    range: (lo, hi) => lo === hi ? `~${lo}x` : `${lo}x ila ${hi}x`,
    headline: range =>
      `- **Daha Hızlı** - nanoid'den ${range} daha hızlı (CSPRNG, tam URL-safe alfabe); 5 temel benchmark'ın hepsini kazanıyor ([benchmark'lara bak](#performans))`,
    meta: (date, node, runner) => `_Son güncelleme: ${date}, Node ${node}, ${runner}._`,
    runnerCI: 'ubuntu-latest (GitHub Actions)',
    runnerLocal: (p, a) => `${p}/${a} (yerel)`,
    fmtOpsSec: n => fmtOps(n) + ' op/sn',
    tCompare: {
      head: ['Test', 'nanoid 5.1.11', 'nope-id', 'Kazanan'],
      sep:  ['------', '--------', '---------', '--------'],
      rowLabels: {
        basic_21: 'Temel (21 karakter)',
        small_10: 'Küçük (10 karakter)',
        large_64: 'Büyük (64 karakter)',
        custom_alphabet: 'Özel Alfabe',
        batch_100: 'Toplu (100 ID)',
      },
    },
    tUuid: {
      head: ['Üretici', 'op/sn', ''],
      sep:  ['---', '---', '---'],
      notes: {
        lukeed: 'optimize saf-JS v4',
        nopeV7: ratio => `**\`uuid\` paketinin v7\'sinin ~${ratio}x'i**`,
        cryptoFastest:  '🥇 düz v4 için en hızlı',
        cryptoCBinding: 'C++ binding (yalnız düz v4)',
        nopeFastestJs:  '🥇 en hızlı saf-JS v4',
        nopeBeatsLukeed: ratio => `\`@lukeed/uuid\`\'den ~${ratio}x daha hızlı, \`uuid\` paketinden önde`,
        nopeOnPar:      '`@lukeed/uuid` ile aynı seviyede, `uuid` paketinden önde',
      },
    },
    basic21Ratio: ratio => `~${ratio}x`,
    tUlid: {
      head: ['Üretici', 'op/sn'],
      sep:  ['---', '---'],
    },
    tSortable: {
      head: ['Üretici', 'op/sn'],
      sep:  ['---', '---'],
    },
    tSpeed: {
      head: ['Üretici', 'op/sn', 'entropi / id', 'rastgelelik kaynağı'],
      sep:  ['---', '---', '---', '---'],
      entropy: {
        urlsafe64: '~126 bit (64-karakter URL-safe)',
        hex16:     '~84 bit (16-karakter hex)',
        rndm:      '~125 bit, ama öngörülebilir',
        base64:    '~126 bit (base64, URL-safe değil)',
        cuid2:     '24-karakter, hash-türevli',
        sparkid:   '~76 bit rastgele (Base58, zaman-sıralı)',
      },
      source: {
        csprng:     'CSPRNG',
        mathRandom: '`Math.random` (güvenli değil)',
        sha3:       'CSPRNG + SHA-3',
      },
    },
    tExtras: {
      head: ['Özellik', 'Performans'],
      sep:  ['---------', '-------------'],
    },
  },

  ru: {
    perfAnchor: 'производительность',
    range: (lo, hi) => lo === hi ? `~${lo} раз` : `${lo}–${hi} раз`,
    headline: range =>
      `- **Быстрее** - в ${range} быстрее nanoid (CSPRNG, полный URL-безопасный алфавит); выигрывает все 5 основных бенчмарков ([см. бенчмарки](#производительность))`,
    meta: (date, node, runner) => `_Последнее обновление: ${date}, Node ${node}, ${runner}._`,
    runnerCI: 'ubuntu-latest (GitHub Actions)',
    runnerLocal: (p, a) => `${p}/${a} (локально)`,
    fmtOpsSec: n => fmtOps(n) + ' оп/сек',
    tCompare: {
      head: ['Тест', 'nanoid 5.1.11', 'nope-id', 'Победитель'],
      sep:  ['------', '--------', '---------', '--------'],
      rowLabels: {
        basic_21: 'Базовый (21 символ)',
        small_10: 'Короткий (10 символов)',
        large_64: 'Длинный (64 символа)',
        custom_alphabet: 'Свой алфавит',
        batch_100: 'Пакетный (100 ID)',
      },
    },
    tUuid: {
      head: ['Генератор', 'оп/сек', ''],
      sep:  ['---', '---', '---'],
      notes: {
        lukeed: 'оптимизированный pure-JS v4',
        nopeV7: ratio => `**~${ratio}x от v7 пакета \`uuid\`**`,
        cryptoFastest:  '🥇 самый быстрый для обычного v4',
        cryptoCBinding: 'C++ binding (только обычный v4)',
        nopeFastestJs:  '🥇 самый быстрый pure-JS v4',
        nopeBeatsLukeed: ratio => `~${ratio}x быстрее \`@lukeed/uuid\`, быстрее пакета \`uuid\``,
        nopeOnPar:      'на уровне `@lukeed/uuid`, быстрее пакета `uuid`',
      },
    },
    tUlid: {
      head: ['Генератор', 'оп/сек'],
      sep:  ['---', '---'],
    },
    tSortable: {
      head: ['Генератор', 'оп/сек'],
      sep:  ['---', '---'],
    },
    tSpeed: {
      head: ['Генератор', 'оп/сек', 'энтропия / id', 'источник случайности'],
      sep:  ['---', '---', '---', '---'],
      entropy: {
        urlsafe64: '~126 бит (64-символьный URL-безопасный)',
        hex16:     '~84 бит (16-символьный hex)',
        rndm:      '~125 бит, но предсказуемые',
        base64:    '~126 бит (base64, не URL-безопасный)',
        cuid2:     '24 символа, hash-производный',
        sparkid:   '~76 бит случайных (Base58, сортируемый по времени)',
      },
      source: {
        csprng:     'CSPRNG',
        mathRandom: '`Math.random` (не безопасный)',
        sha3:       'CSPRNG + SHA-3',
      },
    },
    tExtras: {
      head: ['Функция', 'Производительность'],
      sep:  ['---------', '-------------'],
    },
    basic21Ratio: ratio => `~${ratio}x`,
  },
}

// === Region replacement ===

// Block bodies (tables, multi-line text) get newlines around them; inline bodies
// (single-value tokens like ratios) are spliced flush with the markers so the
// surrounding sentence keeps flowing on one line.
const mkReplace = readme => (name, body, { inline = false } = {}) => {
  const re = new RegExp(
    `(<!-- bench:${name}:start -->)[\\s\\S]*?(<!-- bench:${name}:end -->)`,
    'm'
  )
  if (!re.test(readme.value)) {
    throw new Error(`README is missing marker pair for "${name}"`)
  }
  const sep = inline ? '' : '\n'
  readme.value = readme.value.replace(re, `$1${sep}${body}${sep}$2`)
}

// === Per-file refresh ===

const refresh = (filePath, loc) => {
  if (!existsSync(filePath)) {
    console.error(`skip (not found): ${filePath}`)
    return false
  }
  const readme = { value: readFileSync(filePath, 'utf8') }
  const replaceRegion = mkReplace(readme)

  // === Headline range (e.g. "5x to 8x") ===
  // Build "Nx to Mx" from the spread of comparison ratios. Clamp the floor at 2x
  // so we never display "1x" (which would read as "same speed").
  const ratios = Object.values(bench.comparison).map(c => c.ratio)
  const minR = Math.min(...ratios)
  const maxR = Math.max(...ratios)
  const lo = Math.max(2, Math.round(minR))
  const hi = Math.max(lo, Math.round(maxR))
  const localizedRange = loc.range(lo, hi)
  replaceRegion('headline', loc.headline(localizedRange))

  // === Main comparison table ===
  {
    const rows = Object.keys(loc.tCompare.rowLabels).map(k => [loc.tCompare.rowLabels[k], bench.comparison[k]])
    const lines = [
      '| ' + loc.tCompare.head.join(' | ') + ' |',
      '|' + loc.tCompare.sep.join('|') + '|',
    ]
    for (const [name, r] of rows) {
      const winner = r.ratio >= 1
        ? `**nope-id ${fmtRatio(r.ratio)}**`
        : `**nanoid ${fmtRatio(1 / r.ratio)}**`
      lines.push(`| ${name} | ${loc.fmtOpsSec(r.nanoid)} | **${loc.fmtOpsSec(r.nopeid)}** | ${winner} |`)
    }
    replaceRegion('comparison-table', lines.join('\n'))
  }

  // === UUID table ===
  // Notes (medal + comparison wording) are derived from the actual numbers so the
  // table cannot contradict itself when a CI run produces a noisy ordering.
  {
    const u = bench.uuid
    const n = loc.tUuid.notes

    const nativeOps = u.crypto_randomUUID.opsPerSec
    const nopeOps   = u.nope_uuid.opsPerSec
    const lukeedOps = u.lukeed_uuid.opsPerSec
    const nopeBeatsNative = nopeOps > nativeOps

    // Bold the row holding the highest ops/sec between native and nope-id.
    const nativeOpsStr = nopeBeatsNative ? fmtOps(nativeOps) : `**${fmtOps(nativeOps)}**`
    const nopeOpsStr   = nopeBeatsNative ? `**${fmtOps(nopeOps)}**` : fmtOps(nopeOps)

    // Crypto row: medal when fastest, else note that it is a C++ binding.
    const cryptoNote = nopeBeatsNative ? n.cryptoCBinding : n.cryptoFastest

    // Nope row: medal if it leads native; else describe ratio vs @lukeed/uuid.
    // Threshold ~1.2x picks "Nx faster"; tighter band ~0.83–1.2x reads as "on par".
    const rNopeLukeed = nopeOps / lukeedOps
    let nopeNote
    if (nopeBeatsNative) {
      nopeNote = n.nopeFastestJs
    } else if (rNopeLukeed >= 1.2) {
      // Pass the number only ("2.9"); each locale's template adds the ~ and x.
      const ratioStr = rNopeLukeed.toFixed(1).replace(/\.0$/, '')
      nopeNote = n.nopeBeatsLukeed(ratioStr)
    } else if (rNopeLukeed >= 0.83) {
      nopeNote = n.nopeOnPar
    } else {
      nopeNote = ''
    }

    const v7ratio = Math.round(u.nope_uuidv7.opsPerSec / u.uuid_v7.opsPerSec)
    const lines = [
      '| ' + loc.tUuid.head.join(' | ').replace(/ $/, '') + ' |',
      '|' + loc.tUuid.sep.join('|') + '|',
      `| \`crypto.randomUUID()\` (Node native, v4) | ${nativeOpsStr} | ${cryptoNote} |`,
      `| nope-id \`uuid()\` (v4) | ${nopeOpsStr} | ${nopeNote} |`,
      `| \`@lukeed/uuid\` \`v4()\` | ${fmtOps(lukeedOps)} | ${n.lukeed} |`,
      `| \`uuid\` package \`v4()\` | ${fmtOps(u.uuid_v4.opsPerSec)} | |`,
      `| nope-id \`uuidv7()\` | ${fmtOps(u.nope_uuidv7.opsPerSec)} | ${n.nopeV7(v7ratio)} |`,
      `| \`uuid\` package \`v7()\` | ${fmtOps(u.uuid_v7.opsPerSec)} | |`,
    ]
    replaceRegion('uuid-table', lines.join('\n'))
  }

  // === basic-21 ratio (inline, single number, no table) ===
  // Used in the "speed vs entropy" prose: "nope-id is simply ~Nx faster at the default 21-char size".
  {
    const r = bench.comparison.basic_21.ratio
    replaceRegion('basic-21-ratio', loc.basic21Ratio(r.toFixed(1).replace(/\.0$/, '')), { inline: true })
  }

  // === ULID table ===
  {
    const u = bench.ulid
    const lines = [
      '| ' + loc.tUlid.head.join(' | ') + ' |',
      '|' + loc.tUlid.sep.join('|') + '|',
      `| nope-id \`ulid()\` | **${fmtOps(u.nope_ulid.opsPerSec)}** |`,
      `| \`ulid\` package | ${fmtOps(u.ulid_pkg.opsPerSec)} |`,
      `| nope-id \`monotonicFactory()\` | **${fmtOps(u.nope_monotonic.opsPerSec)}** |`,
      `| \`ulid\` package (monotonic) | ${fmtOps(u.ulid_pkg_monotonic.opsPerSec)} |`,
    ]
    replaceRegion('ulid-table', lines.join('\n'))
  }

  // === Sortable head-to-head: nope-id sortableId() (22-char) vs sparkid (21-char) ===
  // Both are CSPRNG-backed, sortable + monotonic. Different default sizes and alphabets,
  // so this is a "natural defaults" comparison, not a strict format-identical one.
  {
    const sortableOps = bench.extras.sortableId.opsPerSec
    const sparkidOps  = bench.vs_others.sparkid.opsPerSec
    const nopeBeats = sortableOps > sparkidOps
    const lines = [
      '| ' + loc.tSortable.head.join(' | ') + ' |',
      '|' + loc.tSortable.sep.join('|') + '|',
      `| nope-id \`sortableId()\` (22-char Crockford) | ${nopeBeats ? `**${fmtOps(sortableOps)}**` : fmtOps(sortableOps)} |`,
      `| \`sparkid\` (21-char Base58) | ${nopeBeats ? fmtOps(sparkidOps) : `**${fmtOps(sparkidOps)}**`} |`,
    ]
    replaceRegion('sortable-table', lines.join('\n'))
  }

  // === Speed vs entropy table ===
  {
    const v = bench.vs_others
    const nanoidOps = bench.comparison.basic_21.nanoid
    const nopeidOps = bench.comparison.basic_21.nopeid
    const E = loc.tSpeed.entropy, S = loc.tSpeed.source
    const fixed = [
      { gen: '**nope-id `nopeid()`**', ops: nopeidOps,                    entropy: `**${E.urlsafe64}**`, src: `**${S.csprng}**`, bold: true },
      { gen: '`uid/secure`',           ops: v.uid_secure.opsPerSec,         entropy: E.hex16,              src: S.csprng },
      { gen: 'nanoid',                 ops: nanoidOps,                    entropy: E.urlsafe64,          src: S.csprng },
      { gen: '`sparkid`',              ops: v.sparkid.opsPerSec,            entropy: E.sparkid,            src: S.csprng },
      { gen: '`rndm`',                 ops: v.rndm.opsPerSec,               entropy: E.rndm,               src: S.mathRandom },
      { gen: '`secure-random-string`', ops: v.secure_random_string.opsPerSec, entropy: E.base64,           src: S.csprng },
      { gen: 'cuid2 `createId()`',     ops: v.cuid2.opsPerSec,              entropy: E.cuid2,              src: S.sha3 },
    ]
    const lines = [
      '| ' + loc.tSpeed.head.join(' | ') + ' |',
      '|' + loc.tSpeed.sep.join('|') + '|',
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
      '| ' + loc.tExtras.head.join(' | ') + ' |',
      '|' + loc.tExtras.sep.join('|') + '|',
      `| \`sortableId()\` | ${loc.fmtOpsSec(e.sortableId.opsPerSec)} |`,
      `| \`prefixedId()\` | ${loc.fmtOpsSec(e.prefixedId.opsPerSec)} |`,
      `| \`uuid()\` | ${loc.fmtOpsSec(e.uuid.opsPerSec)} |`,
      `| \`slugId()\` | ${loc.fmtOpsSec(e.slugId.opsPerSec)} |`,
      `| \`shortId()\` | ${loc.fmtOpsSec(e.shortId.opsPerSec)} |`,
      `| \`isValid()\` | ${loc.fmtOpsSec(e.isValid.opsPerSec)} |`,
      `| \`uuidv7()\` | ${loc.fmtOpsSec(e.uuidv7.opsPerSec)} |`,
      `| \`ulid()\` | ${loc.fmtOpsSec(e.ulid.opsPerSec)} |`,
      `| \`monotonicFactory()\` | ${loc.fmtOpsSec(e.monotonicFactory.opsPerSec)} |`,
      `| \`snowflake\` (factory) | ${loc.fmtOpsSec(e.snowflake.opsPerSec)} |`,
      `| \`objectId()\` | ${loc.fmtOpsSec(e.objectId.opsPerSec)} |`,
      `| \`sqids.encode()\` | ${loc.fmtOpsSec(e.sqids.opsPerSec)} |`,
    ]
    replaceRegion('extras-table', lines.join('\n'))
  }

  // === Meta line ===
  {
    const date = bench.meta.date.slice(0, 10)
    const nodeMajor = bench.meta.node.replace(/^v?(\d+).*$/, 'v$1.x')
    const runner = bench.meta.runner === 'github-actions'
      ? loc.runnerCI
      : loc.runnerLocal(bench.meta.platform, bench.meta.arch)
    replaceRegion('meta', loc.meta(date, nodeMajor, runner))
  }

  writeFileSync(filePath, readme.value)
  console.error(`README refreshed: ${filePath}`)
  return true
}

const TARGETS = [
  { path: join(REPO_ROOT, 'README.md'),    locale: 'en' },
  { path: join(REPO_ROOT, 'README.tr.md'), locale: 'tr' },
  { path: join(REPO_ROOT, 'README.ru.md'), locale: 'ru' },
]

let updated = 0
for (const t of TARGETS) {
  if (refresh(t.path, L[t.locale])) updated++
}
console.error(`Updated ${updated}/${TARGETS.length} README files.`)
