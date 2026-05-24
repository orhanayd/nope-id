// nope-id - CommonJS version
// Secure, fast, and collision-resistant unique ID generator

'use strict'

const { webcrypto: crypto } = require('node:crypto')

// URL-safe alphabet (optimized for compression)
const urlAlphabet =
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

// Single Set for the default urlAlphabet. isValid() reuses this when the caller
// passes no custom alphabet, instead of building a fresh 64-element Set per call.
const URL_ALPHABET_SET = /* @__PURE__ */ new Set(urlAlphabet)

// Pre-built alphabets for different use cases
// Object.freeze prevents modification and prototype pollution attacks
const alphabets = Object.freeze(Object.create(null, {
  alphanumeric: { value: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', enumerable: true },
  lowercase: { value: 'abcdefghijklmnopqrstuvwxyz', enumerable: true },
  uppercase: { value: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', enumerable: true },
  numbers: { value: '0123456789', enumerable: true },
  hexLower: { value: '0123456789abcdef', enumerable: true },
  hexUpper: { value: '0123456789ABCDEF', enumerable: true },
  nolookalikes: { value: '346789ABCDEFGHJKLMNPQRTUVWXYabcdefghjkmnpqrtwxyz', enumerable: true },
  nolookalikesSafe: { value: '6789BCDFGHJKLMNPQRTWbcdfghjkmnpqrtwz', enumerable: true },
  binary: { value: '01', enumerable: true },
  octal: { value: '01234567', enumerable: true },
  base32: { value: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', enumerable: true },
  base32Lower: { value: 'abcdefghijklmnopqrstuvwxyz234567', enumerable: true },
  base58: { value: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', enumerable: true },
  filename: { value: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_', enumerable: true },
}))

// Crockford's Base32 alphabet for sortable IDs
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
// Char codes (all ASCII, fit in a byte) used to write Crockford ids straight into Buffers.
const CROCKFORD_CODES = /* @__PURE__ */ Uint8Array.from(CROCKFORD_ALPHABET, c => c.charCodeAt(0))

// Reusable 22-byte sortableId scratch buffer (10 ts + 12 random).
const SORT_BUF = /* @__PURE__ */ Buffer.allocUnsafe(22)

// Precomputed byte -> 2-char hex (faster + clearer than toString(16).padStart per byte)
const byteToHex = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'))
// Byte -> hi/lo ASCII hex char codes, used to write directly into UUID_BUF.
const HEX_HI = /* @__PURE__ */ Uint8Array.from(byteToHex, s => s.charCodeAt(0))
const HEX_LO = /* @__PURE__ */ Uint8Array.from(byteToHex, s => s.charCodeAt(1))

// Reusable 36-byte UUID scratch with hyphens pre-baked at 8/13/18/23.
const UUID_BUF = /* @__PURE__ */ Buffer.allocUnsafe(36)
UUID_BUF[8] = UUID_BUF[13] = UUID_BUF[18] = UUID_BUF[23] = 0x2d

// Format 16 bytes as a hyphenated UUID string by writing 32 hex char codes into
// UUID_BUF and one-shot toString'ing — beats 16 string lookups + 4 ConsString joins.
const bytesToUuid = b => {
  UUID_BUF[0]  = HEX_HI[b[0]];  UUID_BUF[1]  = HEX_LO[b[0]]
  UUID_BUF[2]  = HEX_HI[b[1]];  UUID_BUF[3]  = HEX_LO[b[1]]
  UUID_BUF[4]  = HEX_HI[b[2]];  UUID_BUF[5]  = HEX_LO[b[2]]
  UUID_BUF[6]  = HEX_HI[b[3]];  UUID_BUF[7]  = HEX_LO[b[3]]
  UUID_BUF[9]  = HEX_HI[b[4]];  UUID_BUF[10] = HEX_LO[b[4]]
  UUID_BUF[11] = HEX_HI[b[5]];  UUID_BUF[12] = HEX_LO[b[5]]
  UUID_BUF[14] = HEX_HI[b[6]];  UUID_BUF[15] = HEX_LO[b[6]]
  UUID_BUF[16] = HEX_HI[b[7]];  UUID_BUF[17] = HEX_LO[b[7]]
  UUID_BUF[19] = HEX_HI[b[8]];  UUID_BUF[20] = HEX_LO[b[8]]
  UUID_BUF[21] = HEX_HI[b[9]];  UUID_BUF[22] = HEX_LO[b[9]]
  UUID_BUF[24] = HEX_HI[b[10]]; UUID_BUF[25] = HEX_LO[b[10]]
  UUID_BUF[26] = HEX_HI[b[11]]; UUID_BUF[27] = HEX_LO[b[11]]
  UUID_BUF[28] = HEX_HI[b[12]]; UUID_BUF[29] = HEX_LO[b[12]]
  UUID_BUF[30] = HEX_HI[b[13]]; UUID_BUF[31] = HEX_LO[b[13]]
  UUID_BUF[32] = HEX_HI[b[14]]; UUID_BUF[33] = HEX_LO[b[14]]
  UUID_BUF[34] = HEX_HI[b[15]]; UUID_BUF[35] = HEX_LO[b[15]]
  return UUID_BUF.toString('latin1', 0, 36)
}

// Pool management for reduced system calls
// Max pool size is 65536 (crypto.getRandomValues limit)
const POOL_SIZE_MULTIPLIER = 128
const MAX_POOL_SIZE = 65536
let pool, poolOffset

// Fill buffer in chunks if larger than MAX_POOL_SIZE
const fillBuffer = buffer => {
  const len = buffer.length
  for (let offset = 0; offset < len; offset += MAX_POOL_SIZE) {
    const chunk = buffer.subarray(offset, Math.min(offset + MAX_POOL_SIZE, len))
    crypto.getRandomValues(chunk)
  }
}

const fillPool = bytes => {
  if (!pool || pool.length < bytes) {
    const poolSize = Math.min(bytes * POOL_SIZE_MULTIPLIER, MAX_POOL_SIZE)
    pool = Buffer.allocUnsafe(Math.max(poolSize, bytes))
    fillBuffer(pool)
    poolOffset = 0
  } else if (poolOffset + bytes > pool.length) {
    fillBuffer(pool)
    poolOffset = 0
  }
  poolOffset += bytes
}

// Pre-computed char codes of the URL-safe alphabet, indexed by (byte & 63).
// Drives both the 8-bit cold path and the 16-bit batch refill table below.
const URL_ALPHABET_CODES = /* @__PURE__ */ Uint8Array.from(urlAlphabet, c => c.charCodeAt(0))

// Dedicated pool for nopeid(): CSPRNG bytes translated in place to alphabet char codes.
// Each call is then a single Buffer.toString('latin1') — one V8 one-byte string allocation
// per ID, versus ~21 ConsString allocations from `id += alphabet[...]` per character.
// Kept separate from `pool` (raw bytes for random()/customAlphabet()/uuid()/etc.).
let idPool, idPoolOffset, idPoolView, idPoolCodes16, idPoolStr

const fillIdPool = () => {
  if (!idPool) {
    idPool = Buffer.allocUnsafe(MAX_POOL_SIZE)
    idPoolView = new Uint16Array(idPool.buffer, idPool.byteOffset, MAX_POOL_SIZE >> 1)
    // Built lazily on first refill: 64 KiB Uint16Array table maps any 16-bit value
    // (two random bytes) directly to its two translated alphabet codes, so the refill
    // loop runs at half the iteration count. The mapping is endian-agnostic because
    // each output byte still corresponds to its own input byte through URL_ALPHABET_CODES.
    idPoolCodes16 = new Uint16Array(0x10000)
    for (let i = 0; i < 0x10000; i++) {
      idPoolCodes16[i] = (URL_ALPHABET_CODES[(i >> 8) & 63] << 8) | URL_ALPHABET_CODES[i & 63]
    }
  }
  fillBuffer(idPool)
  const view = idPoolView
  const table = idPoolCodes16
  for (let i = 0; i < view.length; i++) view[i] = table[view[i]]
  // Pay V8's Buffer.toString fixed cost once per refill, not once per call.
  // Hot path returns idPoolStr.substring(a,b) — SlicedString for sizes ≥13.
  idPoolStr = idPool.toString('latin1')
  idPoolOffset = 0
}

// Shared zero-length result for non-positive random() requests (avoids pool corruption)
const EMPTY = Buffer.alloc(0)

const random = bytes => {
  bytes |= 0
  if (bytes <= 0) return EMPTY
  fillPool(bytes)
  return pool.subarray(poolOffset - bytes, poolOffset)
}

// Custom random function ID generator (core implementation)
// Uses rejection sampling to eliminate modulo bias
const customRandom = (alphabet, defaultSize, getRandom) => {
  if (!alphabet || alphabet.length === 0) {
    throw new Error('Alphabet cannot be empty')
  }
  const codes = Uint8Array.from(alphabet, c => c.charCodeAt(0))
  const len = alphabet.length
  const mask = (2 << (31 - Math.clz32((len - 1) | 1))) - 1
  const step = Math.ceil((1.6 * mask * defaultSize) / len)

  const CPOOL_TARGET = 32768
  let cPool = '', cPoolOffset = 0

  return (size = defaultSize) => {
    if (size <= 0) return ''
    if (cPoolOffset + size > cPool.length) {
      const buf = Buffer.allocUnsafe(CPOOL_TARGET + step)
      let n = 0
      while (n < CPOOL_TARGET) {
        const bytes = getRandom(step)
        for (let i = 0; i < step; i++) {
          const idx = bytes[i] & mask
          if (idx < len) buf[n++] = codes[idx]
        }
      }
      cPool = buf.toString('latin1', 0, n)
      cPoolOffset = 0
    }
    const start = cPoolOffset
    cPoolOffset += size
    return cPool.substring(start, cPoolOffset)
  }
}

const customAlphabet = (alphabet, defaultSize = 21) => {
  if (!alphabet || alphabet.length === 0) {
    throw new Error('Alphabet cannot be empty')
  }
  if (alphabet.length > 256) {
    throw new Error('Alphabet cannot be longer than 256 characters')
  }
  const codes = Uint8Array.from(alphabet, c => c.charCodeAt(0))
  const len = alphabet.length
  const mask = (2 << (31 - Math.clz32((len - 1) | 1))) - 1
  const step = Math.ceil((1.6 * mask * defaultSize) / len)

  const CPOOL_TARGET = 32768
  let cPool = '', cPoolOffset = 0

  return (size = defaultSize) => {
    if (size <= 0) return ''
    if (cPoolOffset + size > cPool.length) {
      const buf = Buffer.allocUnsafe(CPOOL_TARGET + step)
      let n = 0
      while (n < CPOOL_TARGET) {
        fillPool(step)
        const base = poolOffset - step
        for (let i = 0; i < step; i++) {
          const idx = pool[base + i] & mask
          if (idx < len) buf[n++] = codes[idx]
        }
      }
      cPool = buf.toString('latin1', 0, n)
      cPoolOffset = 0
    }
    const start = cPoolOffset
    cPoolOffset += size
    return cPool.substring(start, cPoolOffset)
  }
}

// Main nopeid function - 21 characters by default
const nopeid = (size = 21) => {
  size |= 0
  if (size <= 0) return ''
  // Cold path: requested size exceeds the pool. Translate one-shot so we don't
  // distort pool sizing (and don't repeatedly refill mid-request).
  if (size > MAX_POOL_SIZE) {
    const raw = Buffer.allocUnsafe(size)
    fillBuffer(raw)
    for (let i = 0; i < size; i++) raw[i] = URL_ALPHABET_CODES[raw[i] & 63]
    return raw.toString('latin1')
  }
  if (!idPool || idPoolOffset + size > MAX_POOL_SIZE) fillIdPool()
  const start = idPoolOffset
  idPoolOffset += size
  return idPoolStr.substring(start, idPoolOffset)
}

// Monotonic state for sortable IDs
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

// Max wait iterations prevents DoS from frozen system clock
const MAX_CLOCK_WAIT_ITERATIONS = 10000

const sortableId = (size = 22) => {
  if (size <= 0) return ''
  const now = Date.now()

  if (now === lastTime) {
    if (!incrementRandom()) {
      // Random overflow - wait for next millisecond with DoS protection
      let iterations = 0
      while (Date.now() === now && iterations++ < MAX_CLOCK_WAIT_ITERATIONS) {
        // Busy wait with iteration limit
      }
      if (iterations >= MAX_CLOCK_WAIT_ITERATIONS) {
        // Clock appears frozen - generate with fresh random anyway
        lastTime = 0
      }
      return sortableId(size)
    }
  } else {
    // Manual loop instead of Array.from(arr, fn) so we don't rely on V8 hoisting.
    lastTime = now
    const bytes = random(RANDOM_LENGTH)
    lastRandom = new Array(RANDOM_LENGTH)
    for (let i = 0; i < RANDOM_LENGTH; i++) lastRandom[i] = bytes[i] & 31
  }

  // Encode directly into a reusable 22-byte buffer (avoids prepend-style ConsString churn).
  let t = now
  for (let i = 9; i >= 0; i--) { SORT_BUF[i] = CROCKFORD_CODES[t & 31]; t = Math.floor(t / 32) }
  for (let i = 0; i < RANDOM_LENGTH; i++) SORT_BUF[10 + i] = CROCKFORD_CODES[lastRandom[i]]

  if (size >= 22) {
    if (size === 22) return SORT_BUF.toString('latin1', 0, 22)
    const extraLen = size - 22
    const tail = Buffer.allocUnsafe(extraLen)
    const extra = random(extraLen)
    for (let i = 0; i < extraLen; i++) tail[i] = CROCKFORD_CODES[extra[i] & 31]
    return SORT_BUF.toString('latin1', 0, 22) + tail.toString('latin1')
  }
  return SORT_BUF.toString('latin1', 0, size)
}

const prefixedId = (prefix, size = 21, separator = '_') => {
  if (typeof prefix !== 'string') {
    throw new Error('Prefix must be a string')
  }
  return `${prefix}${separator}${nopeid(size)}`
}

const generateMany = (count, size = 21) => {
  if (count <= 0) return []
  count |= 0

  const ids = new Array(count)
  for (let i = 0; i < count; i++) {
    ids[i] = nopeid(size)
  }
  return ids
}

// Validate if a string is a valid ID for given alphabet
// Uses constant-time comparison to prevent timing attacks
const isValid = (id, alphabet = urlAlphabet) => {
  if (typeof id !== 'string' || id.length === 0) return false

  // Reuse the hoisted Set for the common (urlAlphabet) case; only allocate when a
  // caller passes a custom alphabet. Set has O(1) lookup either way.
  const charSet = alphabet === urlAlphabet ? URL_ALPHABET_SET : new Set(alphabet)

  // Constant-time validation: always check all characters
  // to prevent timing attacks that could leak valid character positions
  let valid = 1
  for (let i = 0; i < id.length; i++) {
    valid &= charSet.has(id[i]) ? 1 : 0
  }
  return valid === 1
}

// Calculate collision probability using birthday paradox
// Uses BigInt for large values to prevent integer overflow
const collisionProbability = (idLength, alphabetSize = 64) => {
  if (idLength <= 0 || alphabetSize <= 0) {
    throw new Error('Length and alphabet size must be positive')
  }

  // Use BigInt for accurate calculation with large numbers
  const possibleIdsBig = BigInt(alphabetSize) ** BigInt(idLength)
  // Clamped Number kept for the reported totalPossible field (backward compatible)
  const possibleIds = possibleIdsBig > BigInt(Number.MAX_SAFE_INTEGER)
    ? Number.MAX_SAFE_INTEGER
    : Number(possibleIdsBig)
  // Unclamped float drives the statistical metrics (Infinity for huge spaces = correct limits)
  const possibleIdsExact = Number(possibleIdsBig)

  return {
    totalPossible: possibleIds,
    totalPossibleBigInt: possibleIdsBig,
    probabilityForBillion: 1 - Math.exp((-1e9 * (1e9 - 1)) / (2 * possibleIdsExact)),
    safeCount: Math.sqrt(2 * possibleIdsExact * Math.log(2)),
    yearsFor1Percent: Math.sqrt(2 * possibleIdsExact * 0.01) / (365.25 * 24 * 60 * 60 * 1000),
  }
}

const nopeidAsync = async (size = 21) => {
  return nopeid(size)
}

// UUID v4 generator. Backed by a string pool of pre-formatted v4 UUIDs: at refill
// time we draw 4096*16 fresh CSPRNG bytes, apply the v4 version + RFC 4122 variant
// bit patches per slot, write 32 hex chars (hyphens are pre-baked at positions
// 8/13/18/23), then toString once for the whole 144 KiB. Each call is then a single
// substring(start, start+36) — a SlicedString on a flat one-byte parent.
const UUID_POOL_COUNT = 4096
const UUID_POOL_BYTES = UUID_POOL_COUNT * 36
let uuidPool, uuidPoolStr, uuidPoolOffset, uuidRawScratch
const uuid = () => {
  if (!uuidPool || uuidPoolOffset >= UUID_POOL_BYTES) {
    if (!uuidPool) {
      uuidPool = Buffer.allocUnsafe(UUID_POOL_BYTES)
      for (let k = 0; k < UUID_POOL_COUNT; k++) {
        const o = k * 36
        uuidPool[o + 8] = uuidPool[o + 13] = uuidPool[o + 18] = uuidPool[o + 23] = 0x2d
      }
      uuidRawScratch = Buffer.allocUnsafe(UUID_POOL_COUNT * 16)
    }
    fillBuffer(uuidRawScratch)
    const raw = uuidRawScratch
    for (let k = 0; k < UUID_POOL_COUNT; k++) {
      const ri = k << 4
      const oo = k * 36
      const b0 = raw[ri], b1 = raw[ri + 1], b2 = raw[ri + 2], b3 = raw[ri + 3]
      const b4 = raw[ri + 4], b5 = raw[ri + 5]
      const b6 = (raw[ri + 6] & 0x0f) | 0x40
      const b7 = raw[ri + 7]
      const b8 = (raw[ri + 8] & 0x3f) | 0x80
      const b9 = raw[ri + 9]
      const b10 = raw[ri + 10], b11 = raw[ri + 11], b12 = raw[ri + 12]
      const b13 = raw[ri + 13], b14 = raw[ri + 14], b15 = raw[ri + 15]
      uuidPool[oo]      = HEX_HI[b0];  uuidPool[oo + 1]  = HEX_LO[b0]
      uuidPool[oo + 2]  = HEX_HI[b1];  uuidPool[oo + 3]  = HEX_LO[b1]
      uuidPool[oo + 4]  = HEX_HI[b2];  uuidPool[oo + 5]  = HEX_LO[b2]
      uuidPool[oo + 6]  = HEX_HI[b3];  uuidPool[oo + 7]  = HEX_LO[b3]
      uuidPool[oo + 9]  = HEX_HI[b4];  uuidPool[oo + 10] = HEX_LO[b4]
      uuidPool[oo + 11] = HEX_HI[b5];  uuidPool[oo + 12] = HEX_LO[b5]
      uuidPool[oo + 14] = HEX_HI[b6];  uuidPool[oo + 15] = HEX_LO[b6]
      uuidPool[oo + 16] = HEX_HI[b7];  uuidPool[oo + 17] = HEX_LO[b7]
      uuidPool[oo + 19] = HEX_HI[b8];  uuidPool[oo + 20] = HEX_LO[b8]
      uuidPool[oo + 21] = HEX_HI[b9];  uuidPool[oo + 22] = HEX_LO[b9]
      uuidPool[oo + 24] = HEX_HI[b10]; uuidPool[oo + 25] = HEX_LO[b10]
      uuidPool[oo + 26] = HEX_HI[b11]; uuidPool[oo + 27] = HEX_LO[b11]
      uuidPool[oo + 28] = HEX_HI[b12]; uuidPool[oo + 29] = HEX_LO[b12]
      uuidPool[oo + 30] = HEX_HI[b13]; uuidPool[oo + 31] = HEX_LO[b13]
      uuidPool[oo + 32] = HEX_HI[b14]; uuidPool[oo + 33] = HEX_LO[b14]
      uuidPool[oo + 34] = HEX_HI[b15]; uuidPool[oo + 35] = HEX_LO[b15]
    }
    uuidPoolStr = uuidPool.toString('latin1')
    uuidPoolOffset = 0
  }
  const start = uuidPoolOffset
  uuidPoolOffset += 36
  return uuidPoolStr.substring(start, uuidPoolOffset)
}

// Pre-cached generators
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

let fingerprint = null
const getFingerprint = () => {
  if (fingerprint === null) {
    fingerprint = nopeid(4)
  }
  return fingerprint
}

const distributedId = (size = 25) => {
  if (size <= 0) return ''
  const fp = getFingerprint()
  const separator = '_'
  const base = fp + separator

  if (size <= base.length) {
    return base.slice(0, size)
  }

  const remaining = size - base.length
  return base + nopeid(remaining)
}

// === UUID v7 (RFC 9562) - time-ordered, index-friendly ===

// Write a 48-bit millisecond timestamp into the first 6 bytes (big-endian)
const writeTimestamp48 = (bytes, ms) => {
  bytes[0] = Math.floor(ms / 0x10000000000) & 0xff
  bytes[1] = Math.floor(ms / 0x100000000) & 0xff
  bytes[2] = Math.floor(ms / 0x1000000) & 0xff
  bytes[3] = Math.floor(ms / 0x10000) & 0xff
  bytes[4] = Math.floor(ms / 0x100) & 0xff
  bytes[5] = ms & 0xff
}

// UUID v7: 48-bit Unix ms timestamp + version + variant + 74 random bits
const uuidv7 = () => {
  const bytes = random(16)
  writeTimestamp48(bytes, Date.now())
  bytes[6] = (bytes[6] & 0x0f) | 0x70 // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant RFC 4122
  return bytesToUuid(bytes)
}

// === ULID (spec-compliant, 26 chars: 10 timestamp + 16 random, Crockford Base32) ===

// Module-level scratch buffer reused across ulid() calls (no per-call alloc).
const ULID_BUF = /* @__PURE__ */ Buffer.allocUnsafe(26)

// 26-char ULID. Fresh randomness each call (non-monotonic); use monotonicFactory() for ordering.
const ulid = (seedTime = Date.now()) => {
  const bytes = random(16)
  let ms = seedTime
  for (let i = 9; i >= 0; i--) { ULID_BUF[i] = CROCKFORD_CODES[ms % 32]; ms = Math.floor(ms / 32) }
  for (let i = 0; i < 16; i++) ULID_BUF[10 + i] = CROCKFORD_CODES[bytes[i] & 31]
  return ULID_BUF.toString('latin1', 0, 26)
}

// Monotonic ULID factory with ISOLATED state (does not touch global sortableId state).
// Closure buffer is reused; same-ms calls rewrite only the touched random-part bytes.
const monotonicFactory = () => {
  let lastTime = 0
  let lastRand = []
  const out = Buffer.allocUnsafe(26)
  return (seedTime = Date.now()) => {
    if (seedTime <= lastTime) {
      seedTime = lastTime
      for (let i = 15; i >= 0; i--) {
        if (lastRand[i] < 31) {
          lastRand[i]++
          out[10 + i] = CROCKFORD_CODES[lastRand[i]]
          break
        }
        lastRand[i] = 0
        out[10 + i] = CROCKFORD_CODES[0]
      }
      return out.toString('latin1', 0, 26)
    }
    // Manual loop instead of Array.from(arr, fn) so we don't rely on V8 hoisting.
    lastTime = seedTime
    const bytes = random(16)
    lastRand = new Array(16)
    let ms = seedTime
    for (let i = 9; i >= 0; i--) { out[i] = CROCKFORD_CODES[ms % 32]; ms = Math.floor(ms / 32) }
    for (let i = 0; i < 16; i++) {
      lastRand[i] = bytes[i] & 31
      out[10 + i] = CROCKFORD_CODES[lastRand[i]]
    }
    return out.toString('latin1', 0, 26)
  }
}

// === Snowflake (distributed 64-bit ID, returned as a string) ===

const DEFAULT_SNOWFLAKE_EPOCH = 1288834974657n // Twitter epoch (2010-11-04)

// Factory: each instance owns its sequence/timestamp state (coordination-free per node).
// Layout: 41-bit timestamp | 10-bit nodeId | 12-bit sequence.
const snowflakeFactory = (options = {}) => {
  const nodeId = BigInt((options.nodeId | 0) & 0x3ff)
  const epoch = options.epoch != null ? BigInt(options.epoch) : DEFAULT_SNOWFLAKE_EPOCH
  let lastTs = -1n
  let sequence = 0n
  return () => {
    let ts = BigInt(Date.now())
    if (ts <= lastTs) {
      sequence = (sequence + 1n) & 0xfffn
      if (sequence === 0n) {
        do { ts = BigInt(Date.now()) } while (ts <= lastTs)
      } else {
        ts = lastTs
      }
    } else {
      sequence = 0n
    }
    lastTs = ts
    return (((ts - epoch) << 22n) | (nodeId << 12n) | sequence).toString()
  }
}

// Lazy default single-node generator (node id derived from the process fingerprint)
let defaultSnowflake = null
const snowflake = () => {
  if (!defaultSnowflake) {
    const fp = getFingerprint()
    let nodeId = 0
    for (let i = 0; i < fp.length; i++) nodeId = (nodeId * 31 + fp.charCodeAt(i)) & 0x3ff
    defaultSnowflake = snowflakeFactory({ nodeId })
  }
  return defaultSnowflake()
}

// Decode a snowflake string into { timestamp, nodeId, sequence }
const decodeSnowflake = (id, epoch = DEFAULT_SNOWFLAKE_EPOCH) => {
  const n = BigInt(id)
  const ep = BigInt(epoch)
  return {
    timestamp: new Date(Number((n >> 22n) + ep)),
    nodeId: Number((n >> 12n) & 0x3ffn),
    sequence: Number(n & 0xfffn),
  }
}

// === MongoDB ObjectId compatible (24-char hex) ===

let oidMachine = null // 5 random bytes, per-process (lazy)
let oidCounter = 0    // 3-byte incrementing counter (lazy random start)
const objectId = () => {
  if (oidMachine === null) {
    oidMachine = Array.from(random(5))
    const c = random(3)
    oidCounter = (c[0] << 16) | (c[1] << 8) | c[2]
  }
  const ts = Math.floor(Date.now() / 1000)
  oidCounter = (oidCounter + 1) & 0xffffff
  const b = [
    (ts >>> 24) & 0xff, (ts >>> 16) & 0xff, (ts >>> 8) & 0xff, ts & 0xff,
    oidMachine[0], oidMachine[1], oidMachine[2], oidMachine[3], oidMachine[4],
    (oidCounter >>> 16) & 0xff, (oidCounter >>> 8) & 0xff, oidCounter & 0xff,
  ]
  let hex = ''
  for (let i = 0; i < 12; i++) hex += byteToHex[b[i]]
  return hex
}

// Extract the creation Date from an ObjectId (first 4 bytes = seconds)
const decodeObjectIdTime = id => {
  if (typeof id !== 'string' || id.length < 8) throw new Error('Invalid ObjectId')
  return new Date(parseInt(id.slice(0, 8), 16) * 1000)
}

// === Sqids (reversible integer <-> short string encoding; obfuscation, NOT encryption) ===

const DEFAULT_SQIDS_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

const sqidsFactory = (options = {}) => {
  const baseAlphabet = options.alphabet || DEFAULT_SQIDS_ALPHABET
  const minLength = options.minLength || 0
  const blocklist = (options.blocklist || []).map(w => w.toLowerCase())

  if (baseAlphabet.length < 3) throw new Error('Sqids alphabet must be at least 3 characters')
  if (new Set(baseAlphabet).size !== baseAlphabet.length) {
    throw new Error('Sqids alphabet must contain unique characters')
  }

  const shuffle = alpha => {
    const chars = alpha.split('')
    for (let i = 0, j = chars.length - 1; j > 0; i++, j--) {
      const r = (i * j + chars[i].charCodeAt(0) + chars[j].charCodeAt(0)) % chars.length
      const t = chars[i]; chars[i] = chars[r]; chars[r] = t
    }
    return chars.join('')
  }
  const alphabet = shuffle(baseAlphabet)

  const toId = (num, alpha) => {
    const chars = alpha.split('')
    const id = []
    let n = num
    do {
      id.unshift(chars[n % chars.length])
      n = Math.floor(n / chars.length)
    } while (n > 0)
    return id.join('')
  }
  const toNumber = (str, alpha) => {
    const chars = alpha.split('')
    let n = 0
    for (const c of str) n = n * chars.length + chars.indexOf(c)
    return n
  }
  const isBlocked = id => {
    const lower = id.toLowerCase()
    for (const word of blocklist) {
      if (word.length > lower.length) continue
      if (lower.length <= 3 || word.length <= 3) {
        if (lower === word) return true
      } else if (/\d/.test(word)) {
        if (lower.startsWith(word) || lower.endsWith(word)) return true
      } else if (lower.includes(word)) {
        return true
      }
    }
    return false
  }

  const encodeNumbers = (numbers, increment = 0) => {
    if (increment > alphabet.length) throw new Error('Reached max attempts to re-generate the ID')
    let offset = numbers.reduce(
      (a, v, i) => alphabet[v % alphabet.length].charCodeAt(0) + i + a,
      numbers.length
    ) % alphabet.length
    offset = (offset + increment) % alphabet.length
    let alpha = alphabet.slice(offset) + alphabet.slice(0, offset)
    const prefix = alpha[0]
    alpha = alpha.split('').reverse().join('')
    const ret = [prefix]
    for (let i = 0; i < numbers.length; i++) {
      ret.push(toId(numbers[i], alpha.slice(1)))
      if (i < numbers.length - 1) {
        ret.push(alpha[0])
        alpha = shuffle(alpha)
      }
    }
    let id = ret.join('')
    if (minLength > id.length) {
      id += alpha[0]
      while (minLength - id.length > 0) {
        alpha = shuffle(alpha)
        id += alpha.slice(0, Math.min(minLength - id.length, alpha.length))
      }
    }
    if (isBlocked(id)) id = encodeNumbers(numbers, increment + 1)
    return id
  }

  const encode = numbers => {
    if (!numbers || numbers.length === 0) return ''
    for (const n of numbers) {
      if (!Number.isInteger(n) || n < 0) {
        throw new Error('Sqids encode supports non-negative integers only')
      }
    }
    return encodeNumbers(numbers)
  }

  const decode = id => {
    const ret = []
    if (!id) return ret
    for (const c of id) if (!alphabet.includes(c)) return ret
    const prefix = id[0]
    const offset = alphabet.indexOf(prefix)
    let alpha = alphabet.slice(offset) + alphabet.slice(0, offset)
    alpha = alpha.split('').reverse().join('')
    let slug = id.slice(1)
    while (slug.length > 0) {
      const separator = alpha[0]
      const chunks = slug.split(separator)
      if (chunks[0] === '') return ret
      ret.push(toNumber(chunks[0], alpha.slice(1)))
      if (chunks.length > 1) alpha = shuffle(alpha)
      slug = chunks.slice(1).join(separator)
    }
    return ret
  }

  return { encode, decode }
}

// === Typed prefixed IDs (Stripe-style: generator + type guard + parser) ===

const defineId = (prefix, opts = {}) => {
  if (typeof prefix !== 'string') throw new Error('Prefix must be a string')
  const size = opts.size != null ? opts.size : 21
  const separator = opts.separator != null ? opts.separator : '_'
  const alphabet = opts.alphabet || urlAlphabet
  const head = prefix + separator
  const gen = alphabet === urlAlphabet ? () => nopeid(size) : customAlphabet(alphabet, size)
  const check = value =>
    typeof value === 'string' && value.startsWith(head) && isValid(value.slice(head.length), alphabet)
  return {
    generate: () => head + gen(),
    is: check,
    parse: value => (check(value) ? { prefix, id: value.slice(head.length) } : null),
  }
}

// === Format validators ===

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isValidUUID = (id, version) => {
  if (typeof id !== 'string' || !UUID_RE.test(id)) return false
  return version != null ? id[14] === String(version) : true
}

const ULID_RE = /^[0-7][0-9ABCDEFGHJKMNPQRSTVWXYZ]{25}$/i
const isValidULID = id => typeof id === 'string' && ULID_RE.test(id)

// Exports
module.exports = nopeid
module.exports.nopeid = nopeid
module.exports.default = nopeid
module.exports.urlAlphabet = urlAlphabet
module.exports.alphabets = alphabets
module.exports.random = random
module.exports.customAlphabet = customAlphabet
module.exports.customRandom = customRandom
module.exports.prefixedId = prefixedId
module.exports.sortableId = sortableId
module.exports.generateMany = generateMany
module.exports.isValid = isValid
module.exports.collisionProbability = collisionProbability
module.exports.nopeidAsync = nopeidAsync
module.exports.uuid = uuid
module.exports.slugId = slugId
module.exports.shortId = shortId
module.exports.decodeTime = decodeTime
module.exports.getFingerprint = getFingerprint
module.exports.distributedId = distributedId
module.exports.uuidv7 = uuidv7
module.exports.ulid = ulid
module.exports.monotonicFactory = monotonicFactory
module.exports.snowflakeFactory = snowflakeFactory
module.exports.snowflake = snowflake
module.exports.decodeSnowflake = decodeSnowflake
module.exports.objectId = objectId
module.exports.decodeObjectIdTime = decodeObjectIdTime
module.exports.sqidsFactory = sqidsFactory
module.exports.defineId = defineId
module.exports.isValidUUID = isValidUUID
module.exports.isValidULID = isValidULID
