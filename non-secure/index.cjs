// nope-id - Non-secure CommonJS version
// WARNING: Do not use for security-sensitive purposes!

'use strict'

const urlAlphabet =
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

// Single Set for the default urlAlphabet. isValid() reuses this when the caller
// passes no custom alphabet, instead of building a fresh 64-element Set per call.
const URL_ALPHABET_SET = /* @__PURE__ */ new Set(urlAlphabet)

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

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

// Pre-computed char codes of the URL-safe alphabet, indexed by (rand & 63).
// Powers the pooled refill in nopeid() below.
const URL_ALPHABET_CODES = /* @__PURE__ */ Uint8Array.from(urlAlphabet, c => c.charCodeAt(0))

// Cached latin1 decoder: one string per pool refill; ASCII-only pools keep
// 'latin1' exact (see non-secure/index.js).
const POOL_DECODER = /* @__PURE__ */ new TextDecoder('latin1')

// Pool size shared by nopeid() and the ASCII customAlphabet() tier.
const POOL_CHARS = 16384

// Pure-ASCII alphabets get a pooled generator: one Math.random() draw yields
// TWO digits via d = (r * len²) | 0; calls are substrings of a decoded pool
// string. Non-ASCII alphabets keep the per-call fallback (see non-secure/index.js).
const customAlphabet = (alphabet, defaultSize = 21) => {
  if (!alphabet || alphabet.length === 0) {
    throw new Error('Alphabet cannot be empty')
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
      // Cold path: bigger than the pool — build locally with the same draws.
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

// Pooled nopeid: each Math.random() double contributes 24 mantissa bits = FOUR
// 6-bit alphabet indexes; each call is one substring (see non-secure/index.js).
let nsPoolBuf // lazily allocated with the first id
let nsPoolStr = ''
let nsPoolOffset = POOL_CHARS

const refillNsPool = () => {
  if (!nsPoolBuf) nsPoolBuf = new Uint8Array(POOL_CHARS)
  const buf = nsPoolBuf
  const codes = URL_ALPHABET_CODES
  for (let i = 0; i < POOL_CHARS; i += 4) {
    const r = (Math.random() * 16777216) | 0 // 24 uniform bits
    buf[i] = codes[r & 63]
    buf[i + 1] = codes[(r >>> 6) & 63]
    buf[i + 2] = codes[(r >>> 12) & 63]
    buf[i + 3] = codes[(r >>> 18) & 63]
  }
  nsPoolStr = POOL_DECODER.decode(buf)
  nsPoolOffset = 0
}

const nopeid = (size = 21) => {
  size |= 0
  if (size <= 0) return ''
  // Cold path: bigger than the pool — build locally with the same 24-bit trick.
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

// Monotonic state
let lastTime = 0
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

const sortableId = (size = 22) => {
  if (size <= 0) return ''
  let now = Date.now()
  // Clock rewind clamp — see index.js for rationale.
  if (now < lastTime) now = lastTime

  if (now === lastTime) {
    if (!incrementRandom()) {
      while (Date.now() === now) {
        // Busy wait
      }
      return sortableId(size)
    }
  } else {
    lastTime = now
    lastRandom = Array.from({ length: RANDOM_LENGTH }, () => (Math.random() * 32) | 0)
  }

  let timestamp = ''
  let t = now
  for (let i = 9; i >= 0; i--) {
    timestamp = CROCKFORD_ALPHABET[t & 31] + timestamp
    t = Math.floor(t / 32)
  }

  let randomPart = ''
  for (let i = 0; i < RANDOM_LENGTH; i++) {
    randomPart += CROCKFORD_ALPHABET[lastRandom[i]]
  }

  const fullId = timestamp + randomPart

  if (size >= 22) {
    if (size === 22) return fullId
    // Extend with Crockford Base32 to match the rest of the ID's alphabet
    let tail = ''
    for (let i = 0; i < size - 22; i++) tail += CROCKFORD_ALPHABET[(Math.random() * 32) | 0]
    return fullId + tail
  }
  return fullId.slice(0, size)
}

const prefixedId = (prefix, size = 21, separator = '_') => {
  if (typeof prefix !== 'string') {
    throw new Error('Prefix must be a string')
  }
  return `${prefix}${separator}${nopeid(size)}`
}

const GENERATE_MANY_MAX = 1_000_000

const generateMany = (count, size = 21) => {
  count |= 0
  if (count <= 0) return []
  if (count > GENERATE_MANY_MAX) {
    throw new Error(`generateMany count exceeds maximum (${GENERATE_MANY_MAX})`)
  }
  const ids = new Array(count)
  for (let i = 0; i < count; i++) {
    ids[i] = nopeid(size)
  }
  return ids
}

const isValid = (id, alphabet = urlAlphabet) => {
  if (typeof id !== 'string' || id.length === 0) return false

  const charSet = alphabet === urlAlphabet ? URL_ALPHABET_SET : new Set(alphabet)
  for (let i = 0; i < id.length; i++) {
    if (!charSet.has(id[i])) return false
  }
  return true
}

const slugGenerator = customAlphabet(alphabets.lowercase + alphabets.numbers, 12)
const shortGenerator = customAlphabet(alphabets.nolookalikes, 8)

// Slug-friendly ID (lowercase + numbers only). The cached generator's returned closure
// honors any size argument, so we never need to build a fresh factory per call.
const slugId = (size = 12) => slugGenerator(size)

// Short ID without similar-looking characters. Same delegation pattern as slugId.
const shortId = (size = 8) => shortGenerator(size)

const decodeTime = sortableIdStr => {
  if (!sortableIdStr || sortableIdStr.length < 10) {
    throw new Error('Invalid sortable ID')
  }

  let timestamp = 0
  for (let i = 0; i < 10; i++) {
    const char = sortableIdStr[i].toUpperCase()
    const index = CROCKFORD_ALPHABET.indexOf(char)
    if (index === -1) {
      throw new Error(`Invalid character '${sortableIdStr[i]}' in sortable ID`)
    }
    timestamp = timestamp * 32 + index
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
