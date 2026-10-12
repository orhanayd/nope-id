// nope-id - Non-secure CommonJS version
// WARNING: Do not use for security-sensitive purposes!

'use strict'

// URL-safe alphabet
const urlAlphabet =
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

// 256-entry membership table for the default urlAlphabet (charCodeAt-indexed isValid).
const URL_VALID_TABLE = /* @__PURE__ */ (() => {
  const table = new Uint8Array(256)
  for (let i = 0; i < urlAlphabet.length; i++) table[urlAlphabet.charCodeAt(i)] = 1
  return table
})()

// Pre-built alphabets
const alphabets = {
  alphanumeric: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  hexLower: '0123456789abcdef',
  hexUpper: '0123456789ABCDEF',
  nolookalikes: '346789ABCDEFGHJKLMNPQRTUVWXYabcdefghjkmnpqrtwxyz',
  nolookalikesSafe: '6789BCDFGHJKLMNPQRTWbcdfghjkmnpqrtwz',
  binary: '01',
  octal: '01234567',
  base32: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  base32Lower: 'abcdefghijklmnopqrstuvwxyz234567',
  base58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
  filename: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_',
}

// Crockford's Base32 alphabet for sortable IDs
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

// Pre-computed char codes of the URL-safe alphabet, indexed by (rand & 63).
const URL_ALPHABET_CODES = /* @__PURE__ */ Uint8Array.from(urlAlphabet, c => c.charCodeAt(0))

// Cached decoder: one string per pool refill; pools are ASCII, so UTF-8 decoding is
// exact and much faster than 'latin1' (windows-1252); see non-secure/index.js.
const POOL_DECODER = /* @__PURE__ */ new TextDecoder()

// Pool size shared by nopeid() and the ASCII customAlphabet() tier.
const POOL_CHARS = 16384

// ASCII alphabets: pooled generator, two digits per Math.random() draw (see non-secure/index.js).
const customAlphabet = (alphabet, defaultSize = 21) => {
  if (!alphabet) {
    throw new Error('Alphabet cannot be empty')
  }
  // A non-string (e.g. a number) has no usable length and would produce NUL chars.
  if (typeof alphabet !== 'string') {
    throw new Error('Alphabet must be a string')
  }
  if (alphabet.length > 256) {
    throw new Error('Alphabet cannot be longer than 256 characters')
  }
  const seen = new Set()
  for (let i = 0; i < alphabet.length; i++) {
    if (seen.has(alphabet[i])) {
      throw new Error('Alphabet must contain unique characters')
    }
    seen.add(alphabet[i])
  }

  let ascii = true
  for (let i = 0; i < alphabet.length; i++) {
    if (alphabet.charCodeAt(i) > 127) { ascii = false; break }
  }

  if (ascii) {
    const len = alphabet.length
    const len2 = len * len
    const codes = new Uint8Array(len)
    for (let i = 0; i < len; i++) codes[i] = alphabet.charCodeAt(i)
    let poolBuf // lazily allocated with the first generated id
    let poolStr = ''
    let poolOffset = POOL_CHARS
    const refill = () => {
      if (!poolBuf) poolBuf = new Uint8Array(POOL_CHARS)
      const buf = poolBuf
      for (let i = 0; i < POOL_CHARS; i += 2) {
        const d = (Math.random() * len2) | 0
        buf[i] = codes[d % len]
        buf[i + 1] = codes[(d / len) | 0]
      }
      poolStr = POOL_DECODER.decode(buf)
      poolOffset = 0
    }
    return (size = defaultSize) => {
      size |= 0
      if (size <= 0) return ''
      // Cold path: bigger than the pool, built locally with the same draws.
      if (size > POOL_CHARS) {
        const out = new Uint8Array(size)
        let i = 0
        const even = size - 1
        for (; i < even; i += 2) {
          const d = (Math.random() * len2) | 0
          out[i] = codes[d % len]
          out[i + 1] = codes[(d / len) | 0]
        }
        if (i < size) out[i] = codes[(Math.random() * len) | 0]
        return POOL_DECODER.decode(out)
      }
      if (poolOffset + size > POOL_CHARS) refill()
      const start = poolOffset
      poolOffset += size
      return poolStr.substring(start, poolOffset)
    }
  }

  // Non-ASCII fallback: per-call concat (rare; kept simple and allocation-exact)
  return (size = defaultSize) => {
    size |= 0
    if (size <= 0) return ''
    let id = ''
    let i = size
    while (i--) {
      id += alphabet[(Math.random() * alphabet.length) | 0]
    }
    return id
  }
}

// Pooled nopeid: Math.random() draws unpacked into 6-bit alphabet indexes; each
// call is one substring (see non-secure/index.js).
let nsPoolBuf // lazily allocated with the first id
let nsPoolStr = ''
let nsPoolOffset = POOL_CHARS

const refillNsPool = () => {
  if (!nsPoolBuf) nsPoolBuf = new Uint8Array(POOL_CHARS)
  const buf = nsPoolBuf
  const codes = URL_ALPHABET_CODES
  for (let i = 0; i < POOL_CHARS; i += 8) {
    // 48 uniform bits per draw (see non-secure/index.js).
    const r = Math.random() * 16777216
    const hi = r | 0
    const lo = ((r - hi) * 16777216) | 0
    buf[i] = codes[hi & 63]
    buf[i + 1] = codes[(hi >>> 6) & 63]
    buf[i + 2] = codes[(hi >>> 12) & 63]
    buf[i + 3] = codes[(hi >>> 18) & 63]
    buf[i + 4] = codes[lo & 63]
    buf[i + 5] = codes[(lo >>> 6) & 63]
    buf[i + 6] = codes[(lo >>> 12) & 63]
    buf[i + 7] = codes[(lo >>> 18) & 63]
  }
  nsPoolStr = POOL_DECODER.decode(buf)
  nsPoolOffset = 0
}

const nopeid = (size = 21) => {
  size |= 0
  if (size <= 0) return ''
  // Cold path: bigger than the pool, built locally at 24 bits (four chars) per draw.
  if (size > POOL_CHARS) {
    const out = new Uint8Array(size)
    const codes = URL_ALPHABET_CODES
    let i = 0
    const quads = size - 3
    for (; i < quads; i += 4) {
      const r = (Math.random() * 16777216) | 0
      out[i] = codes[r & 63]
      out[i + 1] = codes[(r >>> 6) & 63]
      out[i + 2] = codes[(r >>> 12) & 63]
      out[i + 3] = codes[(r >>> 18) & 63]
    }
    for (let r = (Math.random() * 16777216) | 0; i < size; i++, r >>>= 6) {
      out[i] = codes[r & 63]
    }
    return POOL_DECODER.decode(out)
  }
  if (nsPoolOffset + size > POOL_CHARS) refillNsPool()
  const start = nsPoolOffset
  nsPoolOffset += size
  return nsPoolStr.substring(start, nsPoolOffset)
}

// === FEATURES ===

// Monotonic state (NaN sentinel matches no clock value; see index.js)
let lastTime = NaN
let lastRandom = []
const RANDOM_LENGTH = 12

const incrementRandom = () => {
  for (let i = RANDOM_LENGTH - 1; i >= 0; i--) {
    if (lastRandom[i] < 31) {
      lastRandom[i]++
      return true
    }
    lastRandom[i] = 0
  }
  return false
}

// Cached pieces: ts prefix per ms, counter head on carry; same-ms call advances one digit.
let sortTsPrefix = ''  // 10 Crockford chars for lastTime
let sortRndPrefix = '' // 11 Crockford chars: lastRandom[0..10]
let sortTailChar = ''  // CROCKFORD_ALPHABET[lastRandom[11]]

const rebuildSortRnd = () => {
  let s = ''
  for (let i = 0; i < RANDOM_LENGTH - 1; i++) s += CROCKFORD_ALPHABET[lastRandom[i]]
  sortRndPrefix = s
  sortTailChar = CROCKFORD_ALPHABET[lastRandom[RANDOM_LENGTH - 1]]
}

// Sortable ID with monotonic guarantee.
// @deprecated Prefer the secure orderedId(); see non-secure/index.js.
const sortableId = (size = 22) => {
  // Same coercion as nopeid(): without it 2**32+5 would try to build a 4-billion-char tail.
  size |= 0
  if (size <= 0) return ''
  let now = Date.now()
  // Clock rewind clamp; see index.js for the rationale.
  if (now < lastTime) now = lastTime

  if (now === lastTime) {
    if (lastRandom[RANDOM_LENGTH - 1] < 31) {
      // Common case: only the last counter digit advances.
      sortTailChar = CROCKFORD_ALPHABET[++lastRandom[RANDOM_LENGTH - 1]]
    } else if (incrementRandom()) {
      // Carry propagated into the first 11 digits: rebuild their cached string.
      rebuildSortRnd()
    } else {
      while (Date.now() === now) {
        // Busy wait
      }
      return sortableId(size)
    }
  } else {
    lastTime = now
    lastRandom = Array.from({ length: RANDOM_LENGTH }, () => (Math.random() * 32) | 0)
    rebuildSortRnd()
    let ts = ''
    let t = now
    for (let i = 0; i < 10; i++) {
      ts = CROCKFORD_ALPHABET[t & 31] + ts
      t = Math.floor(t / 32)
    }
    sortTsPrefix = ts
  }

  const base = sortTsPrefix + sortRndPrefix + sortTailChar
  if (size === 22) return base
  if (size > 22) {
    // Extend with Crockford Base32 to match the rest of the ID's alphabet
    let tail = ''
    for (let i = 22; i < size; i++) tail += CROCKFORD_ALPHABET[(Math.random() * 32) | 0]
    return base + tail
  }
  return base.substring(0, size)
}

// Prefixed ID, with a one-entry cache of prefix + separator (see index.js)
let lastPrefix = null
let lastSeparator = null
let lastHead = ''
const prefixedId = (prefix, size = 21, separator = '_') => {
  if (typeof prefix !== 'string') {
    throw new Error('Prefix must be a string')
  }
  if (prefix !== lastPrefix || separator !== lastSeparator) {
    lastPrefix = prefix
    lastSeparator = separator
    lastHead = `${prefix}${separator}`
  }
  return lastHead + nopeid(size)
}

// Generate multiple IDs
const GENERATE_MANY_MAX = 1_000_000

// Batch path slices the shared pool directly (same IDs as a nopeid() loop, cheaper).
const generateMany = (count, size = 21) => {
  count |= 0
  if (count <= 0) return []
  if (count > GENERATE_MANY_MAX) {
    throw new Error(`generateMany count exceeds maximum (${GENERATE_MANY_MAX})`)
  }
  size |= 0
  const ids = new Array(count)
  if (size <= 0 || size > POOL_CHARS) {
    for (let i = 0; i < count; i++) ids[i] = nopeid(size)
    return ids
  }
  let str = nsPoolStr
  let offset = nsPoolOffset
  for (let i = 0; i < count; i++) {
    if (offset + size > POOL_CHARS) {
      refillNsPool()
      str = nsPoolStr
      offset = 0
    }
    const start = offset
    offset += size
    ids[i] = str.substring(start, offset)
  }
  nsPoolOffset = offset
  return ids
}

// Bounded cache (32) of membership tables for custom isValid alphabets; null = non-Latin-1.
const VALID_TABLE_CACHE = new Map()
const validTableFor = alphabet => {
  let table = VALID_TABLE_CACHE.get(alphabet)
  if (table === undefined) {
    table = new Uint8Array(256)
    for (let i = 0; i < alphabet.length; i++) {
      const code = alphabet.charCodeAt(i)
      if (code > 255) { table = null; break }
      table[code] = 1
    }
    if (VALID_TABLE_CACHE.size >= 32) VALID_TABLE_CACHE.clear()
    VALID_TABLE_CACHE.set(alphabet, table)
  }
  return table
}

// Validate ID: charCodeAt-indexed table, Set fallback for non-Latin-1 alphabets.
const isValid = (id, alphabet = urlAlphabet) => {
  if (typeof id !== 'string' || id.length === 0) return false

  const table = alphabet === urlAlphabet ? URL_VALID_TABLE : validTableFor(alphabet)
  if (table === null) {
    const charSet = new Set(alphabet)
    for (let i = 0; i < id.length; i++) {
      if (!charSet.has(id[i])) return false
    }
    return true
  }
  for (let i = 0; i < id.length; i++) {
    if (table[id.charCodeAt(i)] !== 1) return false
  }
  return true
}

// Pre-cached generators, exported directly (the closure carries the default size)

// Slug-friendly ID (lowercase + numbers only), default size 12.
const slugId = customAlphabet(alphabets.lowercase + alphabets.numbers, 12)

// Short ID without similar-looking characters, default size 8.
const shortId = customAlphabet(alphabets.nolookalikes, 8)

// Crockford char code (either case) -> digit value, -1 if invalid (see index.js).
const CROCKFORD_DIGITS = /* @__PURE__ */ (() => {
  const t = new Int8Array(128).fill(-1)
  for (let i = 0; i < 32; i++) {
    t[CROCKFORD_ALPHABET.charCodeAt(i)] = i
    t[CROCKFORD_ALPHABET.toLowerCase().charCodeAt(i)] = i
  }
  return t
})()

// Decode sortable ID timestamp
const decodeTime = sortableIdStr => {
  if (typeof sortableIdStr !== 'string' || sortableIdStr.length < 10) {
    throw new Error('Invalid sortable ID')
  }

  let timestamp = 0
  for (let i = 0; i < 10; i++) {
    const code = sortableIdStr.charCodeAt(i)
    const digit = code < 128 ? CROCKFORD_DIGITS[code] : -1
    if (digit < 0) {
      throw new Error(`Invalid character '${sortableIdStr[i]}' in sortable ID`)
    }
    timestamp = timestamp * 32 + digit
  }

  return new Date(timestamp)
}

module.exports = nopeid
module.exports.nopeid = nopeid
module.exports.default = nopeid
module.exports.urlAlphabet = urlAlphabet
module.exports.alphabets = alphabets
module.exports.customAlphabet = customAlphabet
module.exports.prefixedId = prefixedId
module.exports.sortableId = sortableId
module.exports.generateMany = generateMany
module.exports.isValid = isValid
module.exports.slugId = slugId
module.exports.shortId = shortId
module.exports.decodeTime = decodeTime
