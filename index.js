// nope-id - Secure, fast, and collision-resistant unique ID generator
// A better nanoid alternative with extra features

import { randomFillSync } from 'node:crypto'

// URL-safe alphabet (optimized for compression)
export const urlAlphabet =
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

// 256-entry membership table for the default urlAlphabet. isValid() indexes it
// by charCodeAt — no per-char single-character string allocation like Set.has(id[i]).
const URL_VALID_TABLE = /* @__PURE__ */ (() => {
  const table = new Uint8Array(256)
  for (let i = 0; i < urlAlphabet.length; i++) table[urlAlphabet.charCodeAt(i)] = 1
  return table
})()

// Pre-built alphabets for different use cases
// Object.freeze prevents modification and prototype pollution attacks
export const alphabets = Object.freeze(Object.create(null, {
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

// Crockford's Base32 alphabet for sortable IDs (lexicographically sortable)
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
// Char codes (all ASCII, fit in a byte) used to write Crockford ids straight into Buffers.
const CROCKFORD_CODES = /* @__PURE__ */ Uint8Array.from(CROCKFORD_ALPHABET, c => c.charCodeAt(0))

// Reusable 22-byte sortableId scratch. Big enough for the 10-char timestamp +
// 12-char random base case; longer sizes append a one-shot tail buffer.
const SORT_BUF = /* @__PURE__ */ Buffer.allocUnsafe(22)

// Precomputed byte -> 2-char hex (faster + clearer than toString(16).padStart per byte)
const byteToHex = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'))
// Byte -> hi/lo ASCII hex char codes; feed the packed HEX16_LE store in uuid()'s refill.
const HEX_HI = /* @__PURE__ */ Uint8Array.from(byteToHex, s => s.charCodeAt(0))
const HEX_LO = /* @__PURE__ */ Uint8Array.from(byteToHex, s => s.charCodeAt(1))

// Pool management for reduced system calls; 65536 chars stays the pool ceiling
// (bigger pool strings cross a V8 allocation cliff and pay nothing back).
const POOL_SIZE_MULTIPLIER = 128
const MAX_POOL_SIZE = 65536
let pool, poolOffset

// randomFillSync: same OS-seeded CSPRNG as webcrypto's getRandomValues, no 64 KiB
// per-call cap, thinner wrapper — so no chunk loop is needed.
const fillBuffer = randomFillSync

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
// Used by secureToken's unpooled byte→char mapping.
const URL_ALPHABET_CODES = /* @__PURE__ */ Uint8Array.from(urlAlphabet, c => c.charCodeAt(0))

// Dedicated nopeid() pool: ONE native toString('base64url') per refill. base64url's
// char set equals urlAlphabet's (6 uniform bits/char); 49152 raw bytes (divisible by 3,
// so no padding group) → 65536 pool chars.
const ID_POOL_RAW_BYTES = 49152
let idPool, idPoolOffset, idPoolStr

const fillIdPool = () => {
  if (!idPool) idPool = Buffer.allocUnsafe(ID_POOL_RAW_BYTES)
  fillBuffer(idPool)
  // One encode + string allocation per refill; calls serve idPoolStr.substring().
  idPoolStr = idPool.toString('base64url')
  idPoolOffset = 0
}

// Shared zero-length result for non-positive random() requests (avoids pool corruption)
const EMPTY = Buffer.alloc(0)

// Internal: zero-alloc view INTO the shared pool; bytes may be overwritten by
// the next fillPool(). Only for synchronous translate-and-discard callers.
const randomView = bytes => {
  bytes |= 0
  if (bytes <= 0) return EMPTY
  fillPool(bytes)
  return pool.subarray(poolOffset - bytes, poolOffset)
}

// Public: returns a fresh COPY. Safe to retain across subsequent
// random()/nopeid()/customAlphabet() calls.
export const random = bytes => {
  bytes |= 0
  if (bytes <= 0) return EMPTY
  fillPool(bytes)
  return Buffer.from(pool.subarray(poolOffset - bytes, poolOffset))
}

// Factory-time alphabet validation: empty, oversize, non-Latin-1, and duplicate chars
// are all caught in a single pass. Returns the precomputed char-code lookup table that
// downstream rejection sampling uses to write into Buffers without per-call charCodeAt.
const validateAlphabet = alphabet => {
  if (!alphabet || alphabet.length === 0) {
    throw new Error('Alphabet cannot be empty')
  }
  if (alphabet.length > 256) {
    throw new Error('Alphabet cannot be longer than 256 characters')
  }
  const codes = new Uint8Array(alphabet.length)
  const seen = new Set()
  for (let i = 0; i < alphabet.length; i++) {
    const ch = alphabet[i]
    const code = alphabet.charCodeAt(i)
    if (code > 255) {
      throw new Error('Alphabet must contain only Latin-1 characters (0-255)')
    }
    if (seen.has(ch)) {
      throw new Error('Alphabet must contain unique characters')
    }
    seen.add(ch)
    codes[i] = code
  }
  return codes
}

const CPOOL_TARGET = 32768
// Rejection scratch length: 1.6x headroom toward CPOOL_TARGET, capped at 65536
// (keeps user getRandom implementations that wrap webcrypto safe).
const rejectionScratchLen = (mask, len) =>
  Math.min(65536, Math.ceil((1.6 * (mask + 1) * CPOOL_TARGET) / len))

// Custom random function ID generator (core implementation)
// Uses rejection sampling to eliminate modulo bias
const ERR_GET_RANDOM_SHORT = 'getRandom must return at least the requested number of bytes'

export const customRandom = (alphabet, defaultSize, getRandom) => {
  // Pre-compute constants and char-code lookup table (Uint8Array drives Buffer writes)
  const codes = validateAlphabet(alphabet)
  const len = alphabet.length
  // Calculate mask for rejection sampling (power of 2 - 1)
  const mask = (2 << (31 - Math.clz32((len - 1) | 1))) - 1
  // One bulk getRandom per refill pass instead of ~1000+ tiny step-sized calls.
  // Power-of-2 alphabets accept every byte, so their pass is exactly CPOOL_TARGET.
  const pow2 = mask === len - 1
  const passLen = pow2 ? CPOOL_TARGET : rejectionScratchLen(mask, len)

  // Closure-scoped pool of pre-mapped, rejection-accepted char codes converted to a
  // flat string. Same trick as nopeid()/idPoolStr: pay Buffer.toString's fixed cost
  // once per refill, return a substring per call (SlicedString or short inline copy).
  let cPool = '', cPoolOffset = 0

  return (size = defaultSize) => {
    size |= 0
    if (size <= 0) return ''
    // Cold path for requests larger than the cache: collect into a local buffer
    // without touching the shared cPool.
    if (size > CPOOL_TARGET) {
      const out = Buffer.allocUnsafe(size)
      let n = 0
      while (n < size) {
        const remaining = size - n
        const localStep = pow2
          ? remaining
          : Math.min(65536, Math.max(1, Math.ceil((1.6 * (mask + 1) * remaining) / len)))
        const bytes = getRandom(localStep)
        if (!bytes || bytes.length < localStep) {
          throw new Error(ERR_GET_RANDOM_SHORT)
        }
        for (let i = 0; i < localStep && n < size; i++) {
          const idx = bytes[i] & mask
          if (idx < len) out[n++] = codes[idx]
        }
      }
      return out.toString('latin1')
    }
    if (cPoolOffset + size > cPool.length) {
      const buf = Buffer.allocUnsafe(passLen)
      let n = 0
      while (n < CPOOL_TARGET) {
        const bytes = getRandom(passLen)
        if (!bytes || bytes.length < passLen) {
          throw new Error(ERR_GET_RANDOM_SHORT)
        }
        // Guard n < passLen: a top-up pass after a rare shortfall must not
        // write past `buf` (typed-array writes past the end are silent no-ops,
        // which would desync n from the chars actually stored).
        for (let i = 0; i < passLen && n < passLen; i++) {
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

// Hex pools are twice CPOOL_TARGET: the refill is fully native (no JS loop),
// so a bigger pool halves refill frequency at no per-char cost.
const HEX_POOL_TARGET = 65536

// Custom alphabet factory. Refill tier picked once at factory time: exact hex →
// native toString('hex'); pow-2 length → bulk translate; else bulk rejection
// sampling. Hot path: one cPool.substring per call. Also powers slugId/shortId.
export const customAlphabet = (alphabet, defaultSize = 21) => {
  const codes = validateAlphabet(alphabet)
  const len = alphabet.length
  const mask = (2 << (31 - Math.clz32((len - 1) | 1))) - 1

  let cPool = '', cPoolOffset = 0
  let raw // lazily allocated per-factory refill scratch

  // Tier 1: exact hex alphabets. Every nibble maps 1:1, encode is all native.
  // hexUpper pays one toUpperCase per refill — still far below a JS byte loop.
  if (alphabet === alphabets.hexLower || alphabet === alphabets.hexUpper) {
    const upper = alphabet === alphabets.hexUpper
    return (size = defaultSize) => {
      size |= 0
      if (size <= 0) return ''
      // Cold path: chunked native encode (32768-byte slices → 65536-char strings)
      if (size > HEX_POOL_TARGET) {
        const scratch = Buffer.allocUnsafe(HEX_POOL_TARGET >> 1)
        let out = ''
        while (out.length < size) {
          fillBuffer(scratch)
          out += scratch.toString('hex')
        }
        if (upper) out = out.toUpperCase()
        return out.length > size ? out.slice(0, size) : out
      }
      if (cPoolOffset + size > cPool.length) {
        if (!raw) raw = Buffer.allocUnsafe(HEX_POOL_TARGET >> 1)
        fillBuffer(raw)
        cPool = raw.toString('hex')
        if (upper) cPool = cPool.toUpperCase()
        cPoolOffset = 0
      }
      const start = cPoolOffset
      cPoolOffset += size
      return cPool.substring(start, cPoolOffset)
    }
  }

  // Tier 2: power-of-2 alphabet length — the mask is exact, every byte is
  // accepted, so the refill is one bulk fill + a branch-free translate loop.
  if (mask === len - 1) {
    return (size = defaultSize) => {
      size |= 0
      if (size <= 0) return ''
      // Cold path: same bulk translate, into a one-shot local buffer.
      if (size > CPOOL_TARGET) {
        const out = Buffer.allocUnsafe(size)
        fillBuffer(out)
        for (let i = 0; i < size; i++) out[i] = codes[out[i] & mask]
        return out.toString('latin1')
      }
      if (cPoolOffset + size > cPool.length) {
        if (!raw) raw = Buffer.allocUnsafe(CPOOL_TARGET)
        fillBuffer(raw)
        for (let i = 0; i < CPOOL_TARGET; i++) raw[i] = codes[raw[i] & mask]
        cPool = raw.toString('latin1')
        cPoolOffset = 0
      }
      const start = cPoolOffset
      cPoolOffset += size
      return cPool.substring(start, cPoolOffset)
    }
  }

  // Tier 3: non-power-of-2 — bulk fill a rejection scratch once, accept in a
  // single pass. A rare statistical shortfall triggers one top-up pass.
  const passLen = rejectionScratchLen(mask, len)
  let scratch // lazily allocated alongside `raw`
  return (size = defaultSize) => {
    size |= 0
    if (size <= 0) return ''
    // Cold path for huge requests: local buffers, don't touch the cached cPool.
    if (size > CPOOL_TARGET) {
      const out = Buffer.allocUnsafe(size)
      const localScratch = Buffer.allocUnsafe(passLen)
      let n = 0
      while (n < size) {
        fillBuffer(localScratch)
        for (let i = 0; i < passLen && n < size; i++) {
          const idx = localScratch[i] & mask
          if (idx < len) out[n++] = codes[idx]
        }
      }
      return out.toString('latin1')
    }
    if (cPoolOffset + size > cPool.length) {
      if (!raw) {
        raw = Buffer.allocUnsafe(passLen)
        scratch = Buffer.allocUnsafe(passLen)
      }
      let n = 0
      while (n < CPOOL_TARGET) {
        fillBuffer(scratch)
        // Guard n < passLen: a top-up pass must not write past `raw`
        // (typed-array writes past the end are silent no-ops, which would
        // desync n from the chars actually stored).
        for (let i = 0; i < passLen && n < passLen; i++) {
          const idx = scratch[i] & mask
          if (idx < len) raw[n++] = codes[idx]
        }
      }
      cPool = raw.toString('latin1', 0, n)
      cPoolOffset = 0
    }
    const start = cPoolOffset
    cPoolOffset += size
    return cPool.substring(start, cPoolOffset)
  }
}

// Main nopeid function - 21 characters by default
export const nopeid = (size = 21) => {
  size |= 0
  if (size <= 0) return ''
  // Cold path: encode whole 3-byte groups per 49152-byte slice so every char
  // stays uniform (a partial trailing group would bias the tail chars).
  if (size > MAX_POOL_SIZE) {
    const raw = Buffer.allocUnsafe(ID_POOL_RAW_BYTES)
    let out = ''
    while (out.length < size) {
      fillBuffer(raw)
      out += raw.toString('base64url')
    }
    return out.length > size ? out.slice(0, size) : out
  }
  if (!idPool || idPoolOffset + size > MAX_POOL_SIZE) fillIdPool()
  const start = idPoolOffset
  idPoolOffset += size
  return idPoolStr.substring(start, idPoolOffset)
}

// === COLLISION-RESISTANT FEATURES ===

// Monotonic state for sortable IDs
let lastTime = 0
let lastRandom = []
const RANDOM_LENGTH = 12

// Increment random part for same-millisecond IDs
const incrementRandom = () => {
  for (let i = RANDOM_LENGTH - 1; i >= 0; i--) {
    if (lastRandom[i] < 31) {
      lastRandom[i]++
      return true
    }
    lastRandom[i] = 0
  }
  return false // Overflow - need new timestamp
}

// ULID-like sortable ID, 10-char base32 timestamp + 12-char random, monotonic
// (legacy); the max-wait cap prevents DoS from a frozen clock.
// @deprecated Prefer orderedId(); sizes < 22 truncate and weaken uniqueness.
const MAX_CLOCK_WAIT_ITERATIONS = 10000

// Cached pieces (same pattern as orderedId): ts prefix re-encoded per ms,
// counter head only on carry; hot same-ms call bumps one char code.
let sortTsPrefix = ''   // 10 Crockford chars for lastTime
let sortRndPrefix = ''  // 11 Crockford chars: lastRandom[0..10]
let sortTailCode = 0    // char code of CROCKFORD_CODES[lastRandom[11]]

const rebuildSortRnd = () => {
  for (let i = 0; i < 11; i++) SORT_BUF[i] = CROCKFORD_CODES[lastRandom[i]]
  sortRndPrefix = SORT_BUF.toString('latin1', 0, 11)
  sortTailCode = CROCKFORD_CODES[lastRandom[11]]
}

export const sortableId = (size = 22) => {
  if (size <= 0) return ''
  let now = Date.now()
  // Clock rewind (NTP correction, VM resume, container time-skew): clamp to lastTime
  // so we never emit a smaller timestamp than something we've already returned.
  // Without this, a backwards Date.now() would fall through to the `else` branch
  // and produce a non-monotonic ID with a fresh random part.
  if (now < lastTime) now = lastTime

  if (now === lastTime) {
    // Same millisecond - increment random part for monotonicity
    if (lastRandom[RANDOM_LENGTH - 1] < 31) {
      // Common case: only the last counter digit advances.
      sortTailCode = CROCKFORD_CODES[++lastRandom[RANDOM_LENGTH - 1]]
    } else if (incrementRandom()) {
      // Carry propagated into the first 11 digits — rebuild their cached string.
      rebuildSortRnd()
    } else {
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
    // New millisecond - generate fresh random. Manual loop instead of Array.from(arr, fn)
    // so we don't rely on V8 to hoist the (b => b & 31) literal.
    lastTime = now
    const bytes = randomView(RANDOM_LENGTH)
    lastRandom = new Array(RANDOM_LENGTH)
    for (let i = 0; i < RANDOM_LENGTH; i++) lastRandom[i] = bytes[i] & 31
    rebuildSortRnd()
    let t = now
    for (let i = 9; i >= 0; i--) { SORT_BUF[i] = CROCKFORD_CODES[t & 31]; t = Math.floor(t / 32) }
    sortTsPrefix = SORT_BUF.toString('latin1', 0, 10)
  }

  const base = sortTsPrefix + sortRndPrefix + String.fromCharCode(sortTailCode)
  if (size === 22) return base
  if (size > 22) {
    // Extend with Crockford Base32 (not urlAlphabet) so the whole ID stays in the
    // documented alphabet; & 31 over random bytes is bias-free (256 / 32 = 8).
    const extraLen = size - 22
    const tail = Buffer.allocUnsafe(extraLen)
    const extra = randomView(extraLen)
    for (let i = 0; i < extraLen; i++) tail[i] = CROCKFORD_CODES[extra[i] & 31]
    return base + tail.toString('latin1')
  }
  return base.substring(0, size)
}

// Prefixed ID generator
export const prefixedId = (prefix, size = 21, separator = '_') => {
  if (typeof prefix !== 'string') {
    throw new Error('Prefix must be a string')
  }
  return `${prefix}${separator}${nopeid(size)}`
}

// Cap a single request: >1M strings in one Array wants a stream instead.
const GENERATE_MANY_MAX = 1_000_000

// Generate multiple unique IDs at once; the batch path slices the shared id
// pool directly with hoisted locals (same IDs as a nopeid() loop, cheaper).
export const generateMany = (count, size = 21) => {
  count |= 0
  if (count <= 0) return []
  if (count > GENERATE_MANY_MAX) {
    throw new Error(`generateMany count exceeds maximum (${GENERATE_MANY_MAX})`)
  }
  size |= 0
  const ids = new Array(count)
  if (size <= 0 || size > MAX_POOL_SIZE) {
    // Degenerate/cold sizes: defer to nopeid's own handling per entry.
    for (let i = 0; i < count; i++) ids[i] = nopeid(size)
    return ids
  }
  if (!idPool) fillIdPool()
  let str = idPoolStr
  let offset = idPoolOffset
  for (let i = 0; i < count; i++) {
    if (offset + size > MAX_POOL_SIZE) {
      fillIdPool()
      str = idPoolStr
      offset = 0
    }
    const start = offset
    offset += size
    ids[i] = str.substring(start, offset)
  }
  idPoolOffset = offset
  return ids
}

// Bounded cache (32) of 256-entry membership tables for custom isValid
// alphabets; null marks non-Latin-1 (Set fallback).
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

// Validate a string against an alphabet. Non-short-circuit table scan (avoids the
// naive first-bad-char timing oracle; NOT strictly constant-time); charCodeAt +
// table beats Set.has per-char allocation.
export const isValid = (id, alphabet = urlAlphabet) => {
  if (typeof id !== 'string' || id.length === 0) return false

  const table = alphabet === urlAlphabet ? URL_VALID_TABLE : validTableFor(alphabet)
  if (table === null) {
    // Rare: alphabet itself contains non-Latin-1 chars — table can't represent it.
    const charSet = new Set(alphabet)
    let valid = 1
    for (let i = 0; i < id.length; i++) {
      valid &= charSet.has(id[i]) ? 1 : 0
    }
    return valid === 1
  }
  let valid = 1
  for (let i = 0; i < id.length; i++) {
    valid &= table[id.charCodeAt(i)]
  }
  return valid === 1
}

// Calculate collision probability using birthday paradox
// Uses BigInt for large values to prevent integer overflow
export const collisionProbability = (idLength, alphabetSize = 64) => {
  if (idLength <= 0 || alphabetSize <= 0) {
    throw new Error('Length and alphabet size must be positive')
  }

  // Use BigInt for accurate calculation with large numbers
  const possibleIdsBig = BigInt(alphabetSize) ** BigInt(idLength)
  // Clamped Number kept for the reported totalPossible field (backward compatible)
  const possibleIds = possibleIdsBig > BigInt(Number.MAX_SAFE_INTEGER)
    ? Number.MAX_SAFE_INTEGER
    : Number(possibleIdsBig)
  // Unclamped float drives the statistical metrics (doubles reach ~1.8e308;
  // Infinity for astronomically large spaces yields the correct limits)
  const possibleIdsExact = Number(possibleIdsBig)

  return {
    totalPossible: possibleIds,
    totalPossibleBigInt: possibleIdsBig,
    // Probability of collision when generating 1 billion IDs.
    // -Math.expm1(x) computes 1 - exp(x) accurately for x near 0 (which is the
    // common case for safe id sizes); the naive 1 - exp(x) form loses precision
    // and reports 0 when exp(x) rounds to 1.
    probabilityForBillion: -Math.expm1((-1e9 * (1e9 - 1)) / (2 * possibleIdsExact)),
    // Safe count before 50% collision probability
    safeCount: Math.sqrt(2 * possibleIdsExact * Math.log(2)),
    // Years to generate 1 ID/ms before 1% collision probability
    yearsFor1Percent: Math.sqrt(2 * possibleIdsExact * 0.01) / (365.25 * 24 * 60 * 60 * 1000),
  }
}

// Async version for large batch operations
export const nopeidAsync = async (size = 21) => {
  return nopeid(size)
}

// UUID v4 pool: pre-formatted 4096-slot refill (own 16 CSPRNG bytes per UUID,
// v4/variant bits patched, hyphens pre-baked); one 36-char substring per call.
const UUID_POOL_COUNT = 4096
const UUID_POOL_BYTES = UUID_POOL_COUNT * 36

// byte → both hex char codes packed for one 16-bit LE store; DataView because
// hyphen offsets leave half the pairs unaligned. Built lazily with the pool.
let HEX16_LE = null
let uuidPool, uuidPoolView, uuidPoolStr, uuidPoolOffset, uuidRawScratch
export const uuid = () => {
  if (!uuidPool || uuidPoolOffset >= UUID_POOL_BYTES) {
    if (!uuidPool) {
      uuidPool = Buffer.allocUnsafe(UUID_POOL_BYTES)
      uuidPoolView = new DataView(uuidPool.buffer, uuidPool.byteOffset, UUID_POOL_BYTES)
      for (let k = 0; k < UUID_POOL_COUNT; k++) {
        const o = k * 36
        uuidPool[o + 8] = uuidPool[o + 13] = uuidPool[o + 18] = uuidPool[o + 23] = 0x2d
      }
      uuidRawScratch = Buffer.allocUnsafe(UUID_POOL_COUNT * 16)
      HEX16_LE = new Uint16Array(256)
      for (let b = 0; b < 256; b++) HEX16_LE[b] = HEX_HI[b] | (HEX_LO[b] << 8)
    }
    fillBuffer(uuidRawScratch)
    const raw = uuidRawScratch
    const dv = uuidPoolView
    const hx = HEX16_LE
    for (let k = 0; k < UUID_POOL_COUNT; k++) {
      const ri = k << 4
      const oo = k * 36
      // Patch version (4) into byte 6 and RFC 4122 variant into byte 8, then
      // write each byte's two hex chars with a single 16-bit store.
      dv.setUint16(oo,      hx[raw[ri]], true)
      dv.setUint16(oo + 2,  hx[raw[ri + 1]], true)
      dv.setUint16(oo + 4,  hx[raw[ri + 2]], true)
      dv.setUint16(oo + 6,  hx[raw[ri + 3]], true)
      dv.setUint16(oo + 9,  hx[raw[ri + 4]], true)
      dv.setUint16(oo + 11, hx[raw[ri + 5]], true)
      dv.setUint16(oo + 14, hx[(raw[ri + 6] & 0x0f) | 0x40], true)
      dv.setUint16(oo + 16, hx[raw[ri + 7]], true)
      dv.setUint16(oo + 19, hx[(raw[ri + 8] & 0x3f) | 0x80], true)
      dv.setUint16(oo + 21, hx[raw[ri + 9]], true)
      dv.setUint16(oo + 24, hx[raw[ri + 10]], true)
      dv.setUint16(oo + 26, hx[raw[ri + 11]], true)
      dv.setUint16(oo + 28, hx[raw[ri + 12]], true)
      dv.setUint16(oo + 30, hx[raw[ri + 13]], true)
      dv.setUint16(oo + 32, hx[raw[ri + 14]], true)
      dv.setUint16(oo + 34, hx[raw[ri + 15]], true)
    }
    uuidPoolStr = uuidPool.toString('latin1')
    uuidPoolOffset = 0
  }
  const start = uuidPoolOffset
  uuidPoolOffset += 36
  return uuidPoolStr.substring(start, uuidPoolOffset)
}

// Pre-cached generators for common use cases (performance optimization)
const slugGenerator = customAlphabet(alphabets.lowercase + alphabets.numbers, 12)
const shortGenerator = customAlphabet(alphabets.nolookalikes, 8)

// Slug-friendly ID (lowercase + numbers only). The cached generator's returned closure
// honors any size argument, so we never need to build a fresh factory per call.
export const slugId = (size = 12) => slugGenerator(size)

// Short ID without similar-looking characters. Same delegation pattern as slugId.
export const shortId = (size = 8) => shortGenerator(size)

// Decode sortable ID timestamp
export const decodeTime = sortableIdStr => {
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

// Fingerprint generator (device/process specific prefix)
let fingerprint = null
export const getFingerprint = () => {
  if (fingerprint === null) {
    // Generate once per process
    fingerprint = nopeid(4)
  }
  return fingerprint
}

// Minimum total length for distributedId. The fingerprint + separator already
// consumes 5 chars; this leaves ≥11 random chars (~64 bits), enough that the
// "fingerprint prefix" is actually paired with collision-resistant entropy.
const DISTRIBUTED_ID_MIN = 16

// ID with a process-fingerprint prefix. Useful for tracing ID origin in
// multi-process / multi-node systems. Collision resistance comes from the
// random tail — small sizes are rejected so the name doesn't lie.
export const distributedId = (size = 25) => {
  if (!Number.isInteger(size) || size < DISTRIBUTED_ID_MIN) {
    throw new Error(`distributedId size must be an integer >= ${DISTRIBUTED_ID_MIN}`)
  }
  const fp = getFingerprint()
  return fp + '_' + nopeid(size - fp.length - 1)
}

// === UUID v7 (RFC 9562) - time-ordered, index-friendly ===

// Shared pooled hex string: 32768 CSPRNG bytes → 65536 hex chars per refill,
// served as substrings. Used for uuidv7's random tail chars.
let hexPoolStr = '', hexPoolOffset = 0, hexPoolRaw
const hexTail = n => {
  if (hexPoolOffset + n > hexPoolStr.length) {
    if (!hexPoolRaw) hexPoolRaw = Buffer.allocUnsafe(32768)
    fillBuffer(hexPoolRaw)
    hexPoolStr = hexPoolRaw.toString('hex')
    hexPoolOffset = 0
  }
  const start = hexPoolOffset
  hexPoolOffset += n
  return hexPoolStr.substring(start, hexPoolOffset)
}

// Variant pick keyed by the hex char's VALUE (a raw code&3 would bias via the
// 0-9/a-f code gap): uniform over '89ab'.
const VARIANT_FROM_HEX_CODE = /* @__PURE__ */ (() => {
  const table = new Array(256).fill('8')
  const hex = '0123456789abcdef'
  for (let v = 0; v < 16; v++) table[hex.charCodeAt(v)] = '89ab'[v & 3]
  return table
})()

// UUID v7: 48-bit ms timestamp + version + variant + 74 random bits. The
// 15-char "tttttttt-tttt-7" prefix is cached per ms; pooled hex fills the rest.
let v7LastMs = -1
let v7Prefix = ''
export const uuidv7 = () => {
  const ms = Date.now()
  if (ms !== v7LastMs) {
    v7LastMs = ms
    const hi = Math.floor(ms / 0x100000000) // top 16 of the 48-bit timestamp
    const lo = ms >>> 0                     // low 32 bits
    v7Prefix = byteToHex[(hi >>> 8) & 0xff] + byteToHex[hi & 0xff] +
      byteToHex[(lo >>> 24) & 0xff] + byteToHex[(lo >>> 16) & 0xff] + '-' +
      byteToHex[(lo >>> 8) & 0xff] + byteToHex[lo & 0xff] + '-7'
  }
  const r = hexTail(19)
  // r[0] seeds the variant pick; r[1..18] are the 18 random hex chars
  // (12 rand_a bits after the version + 60 of rand_b; variant supplies 2 more).
  return v7Prefix + r.substring(1, 4) + '-' +
    VARIANT_FROM_HEX_CODE[r.charCodeAt(0)] + r.substring(4, 7) + '-' +
    r.substring(7, 19)
}

// === ULID (spec-compliant, 26 chars: 10 timestamp + 16 random, Crockford Base32) ===

// Module-level scratch buffer for encoding the 10-char ULID timestamp prefix.
const ULID_BUF = /* @__PURE__ */ Buffer.allocUnsafe(10)

// Pooled Crockford string for ulid()'s 16 random chars (byte & 31 — bias-free, 256/32=8).
let crockPoolStr = '', crockPoolOffset = 0, crockPoolRaw
const crockTail = n => {
  if (crockPoolOffset + n > crockPoolStr.length) {
    if (!crockPoolRaw) crockPoolRaw = Buffer.allocUnsafe(32768)
    fillBuffer(crockPoolRaw)
    const raw = crockPoolRaw
    for (let i = 0; i < 32768; i++) raw[i] = CROCKFORD_CODES[raw[i] & 31]
    crockPoolStr = raw.toString('latin1')
    crockPoolOffset = 0
  }
  const start = crockPoolOffset
  crockPoolOffset += n
  return crockPoolStr.substring(start, crockPoolOffset)
}

// ULID timestamps are 48-bit per spec; shared by ulid() + monotonicFactory().
const ULID_TIME_MAX = 281474976710655 // 2^48 - 1
const ULID_TIME_ERROR = 'ULID seedTime must be an integer between 0 and 281474976710655'
const isUlidTime = t => Number.isInteger(t) && t >= 0 && t <= ULID_TIME_MAX

// 26-char ULID (non-monotonic; use monotonicFactory() for ordering): per-ms
// cached timestamp prefix + pooled Crockford random tail.
let ulidLastMs = NaN // NaN sentinel: equals no valid seed, so the first call always encodes
let ulidPrefix = ''
export const ulid = (seedTime = Date.now()) => {
  if (seedTime !== ulidLastMs) {
    if (!isUlidTime(seedTime)) throw new Error(ULID_TIME_ERROR)
    ulidLastMs = seedTime
    let ms = seedTime
    for (let i = 9; i >= 0; i--) { ULID_BUF[i] = CROCKFORD_CODES[ms % 32]; ms = Math.floor(ms / 32) }
    ulidPrefix = ULID_BUF.toString('latin1', 0, 10)
  }
  return ulidPrefix + crockTail(16)
}

// Monotonic ULID factory with ISOLATED state (does not touch global sortableId state).
// Same/backwards-ms calls bump the random part as a base-32 counter, rewriting only
// the changed byte(s) in the reused scratch.
export const monotonicFactory = () => {
  let lastTime = NaN // NaN sentinel: <= matches no seed, so the first call always encodes
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
    } else if (isUlidTime(seedTime)) {
      // Manual loop instead of Array.from(arr, fn) so we don't rely on V8 hoisting.
      lastTime = seedTime
      const bytes = randomView(16)
      lastRand = new Array(16)
      let ms = seedTime
      for (let i = 9; i >= 0; i--) { out[i] = CROCKFORD_CODES[ms % 32]; ms = Math.floor(ms / 32) }
      for (let i = 0; i < 16; i++) {
        lastRand[i] = bytes[i] & 31
        out[10 + i] = CROCKFORD_CODES[lastRand[i]]
      }
    } else {
      throw new Error(ULID_TIME_ERROR)
    }
    return out.toString('latin1', 0, 26)
  }
}

// === Snowflake (distributed 64-bit ID, returned as a string) ===

const DEFAULT_SNOWFLAKE_EPOCH = 1288834974657n // Twitter epoch (2010-11-04)

// Factory: each instance owns its sequence/timestamp state (coordination-free per node).
// Layout: 41-bit timestamp | 10-bit nodeId | 12-bit sequence.
export const snowflakeFactory = (options = {}) => {
  const rawNodeId = options.nodeId == null ? 0 : options.nodeId
  if (!Number.isInteger(rawNodeId) || rawNodeId < 0 || rawNodeId > 1023) {
    throw new Error('snowflakeFactory nodeId must be an integer between 0 and 1023')
  }
  const nodeId = BigInt(rawNodeId)
  let epoch = DEFAULT_SNOWFLAKE_EPOCH
  if (options.epoch != null) {
    try { epoch = BigInt(options.epoch) } catch { throw new Error('Invalid snowflake epoch') }
  }
  let lastTs = -1n
  let sequence = 0n
  return () => {
    let ts = BigInt(Date.now())
    if (ts <= lastTs) {
      // Same ms (or clock moved back): bump sequence; roll to next ms on overflow
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
export const snowflake = () => {
  if (!defaultSnowflake) {
    const fp = getFingerprint()
    let nodeId = 0
    for (let i = 0; i < fp.length; i++) nodeId = (nodeId * 31 + fp.charCodeAt(i)) & 0x3ff
    defaultSnowflake = snowflakeFactory({ nodeId })
  }
  return defaultSnowflake()
}

const SNOWFLAKE_ID_RE = /^\d{1,20}$/

// Decode a snowflake (digit string, bigint, or safe non-negative integer)
// into { timestamp, nodeId, sequence }
export const decodeSnowflake = (id, epoch = DEFAULT_SNOWFLAKE_EPOCH) => {
  const t = typeof id
  if (!(t === 'bigint' || (t === 'string' && SNOWFLAKE_ID_RE.test(id)) ||
        (t === 'number' && Number.isSafeInteger(id) && id >= 0))) {
    throw new Error('Invalid Snowflake ID')
  }
  let ep
  try { ep = BigInt(epoch) } catch { throw new Error('Invalid snowflake epoch') }
  const n = BigInt(id)
  return {
    timestamp: new Date(Number((n >> 22n) + ep)),
    nodeId: Number((n >> 12n) & 0x3ffn),
    sequence: Number(n & 0xfffn),
  }
}

// === MongoDB ObjectId compatible (24-char hex) ===

// ObjectId: the 18-hex ts+machine prefix changes at most once per second and is
// cached as one string; each call formats only the 6-hex-char counter.
let oidCounter = 0     // 3-byte incrementing counter (lazy random start)
let oidLastSec = -1    // second the cached prefix was built for
let oidPrefix = null   // 18 hex chars: 8 timestamp + 10 machine (null = lazy init pending)
let oidMachineHex = ''
export const objectId = () => {
  if (oidPrefix === null) {
    const m = randomView(5)
    oidMachineHex = byteToHex[m[0]] + byteToHex[m[1]] + byteToHex[m[2]] +
      byteToHex[m[3]] + byteToHex[m[4]]
    const c = randomView(3)
    oidCounter = (c[0] << 16) | (c[1] << 8) | c[2]
  }
  const sec = Math.floor(Date.now() / 1000) // not |0: stays valid past 2038
  if (sec !== oidLastSec) {
    oidLastSec = sec
    oidPrefix = byteToHex[(sec >>> 24) & 0xff] + byteToHex[(sec >>> 16) & 0xff] +
      byteToHex[(sec >>> 8) & 0xff] + byteToHex[sec & 0xff] + oidMachineHex
  }
  oidCounter = (oidCounter + 1) & 0xffffff
  return oidPrefix +
    byteToHex[(oidCounter >>> 16) & 0xff] + byteToHex[(oidCounter >>> 8) & 0xff] +
    byteToHex[oidCounter & 0xff]
}

// 24-char hex pattern: rejects non-hex input at the boundary (a length-only
// check let 'z'.repeat(24) silently return Invalid Date).
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/

// Extract the creation Date from an ObjectId (first 4 bytes = seconds)
export const decodeObjectIdTime = id => {
  if (typeof id !== 'string' || !OBJECT_ID_RE.test(id)) {
    throw new Error('Invalid ObjectId')
  }
  return new Date(parseInt(id.slice(0, 8), 16) * 1000)
}

// === Sqids (reversible integer <-> short string encoding; obfuscation, NOT encryption) ===

const DEFAULT_SQIDS_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export const sqidsFactory = (options = {}) => {
  const baseAlphabet = options.alphabet || DEFAULT_SQIDS_ALPHABET
  const minLength = options.minLength || 0
  const blocklist = (options.blocklist || []).map(w => w.toLowerCase())

  if (baseAlphabet.length < 3) throw new Error('Sqids alphabet must be at least 3 characters')
  if (new Set(baseAlphabet).size !== baseAlphabet.length) {
    throw new Error('Sqids alphabet must contain unique characters')
  }

  // Deterministic shuffle (no PRNG; derived from the alphabet itself)
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

// Shared is()-style guard for defineId()/defineToken(): exact head + exact body
// length + alphabet membership (a bare 'usr_a' must not pass).
const makePrefixedCheck = (head, size, alphabet) => value => {
  if (typeof value !== 'string') return false
  if (!value.startsWith(head)) return false
  const body = value.slice(head.length)
  return body.length === size && isValid(body, alphabet)
}

export const defineId = (prefix, opts = {}) => {
  if (typeof prefix !== 'string') throw new Error('Prefix must be a string')
  const size = opts.size != null ? opts.size : 21
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error('Size must be a positive integer')
  }
  const separator = opts.separator != null ? opts.separator : '_'
  const alphabet = opts.alphabet || urlAlphabet
  const head = prefix + separator
  const gen = alphabet === urlAlphabet ? () => nopeid(size) : customAlphabet(alphabet, size)
  const check = makePrefixedCheck(head, size, alphabet)
  return {
    generate: () => head + gen(),
    is: check,
    parse: value => (check(value) ? { prefix, id: value.slice(head.length) } : null),
  }
}

// === Secure bearer tokens (unpooled, ephemeral) ===
// Each call is self-contained: fresh buffer, CSPRNG fill, map, zero the raw
// bytes — no future-token cache to leak (unlike pooled nopeid()).

const SECURE_TOKEN_MIN = 32
const SECURE_TOKEN_MAX = 65536

/**
 * Generate a bearer token (URL-safe 64-char alphabet, bias-free CSPRNG).
 * Unpooled: no future-token cache; the raw byte buffer is zeroized before
 * returning, but the returned V8 string itself cannot be zeroized (immutable,
 * GC heap). Store HASHED tokens (e.g. SHA-256), never the raw value.
 *
 * @param size - Token length in characters (default 48, min 32, max 65536)
 * @returns A URL-safe random token
 * @throws Error if size is not an integer in [32, 65536]
 */
export const secureToken = (size = 48) => {
  if (!Number.isInteger(size) || size < SECURE_TOKEN_MIN || size > SECURE_TOKEN_MAX) {
    throw new Error(`secureToken size must be an integer between ${SECURE_TOKEN_MIN} and ${SECURE_TOKEN_MAX}`)
  }
  // Local buffer — bypasses both the shared `pool` and the cached `idPoolStr`.
  const buf = Buffer.allocUnsafe(size)
  fillBuffer(buf)  // direct CSPRNG fill
  for (let i = 0; i < size; i++) {
    buf[i] = URL_ALPHABET_CODES[buf[i] & 63]
  }
  const token = buf.toString('latin1')
  buf.fill(0)  // best-effort zeroize raw bytes; string itself stays in V8 heap
  return token
}

const validateTokenPrefix = (prefix, label) => {
  if (typeof prefix !== 'string' || prefix.length === 0) {
    throw new Error(`${label} prefix must be a non-empty string`)
  }
  if (/\s/.test(prefix)) {
    throw new Error(`${label} prefix must not contain whitespace`)
  }
}

/**
 * Generate a prefixed API key, e.g. 'nope_live_<token>'.
 * Body is generated via secureToken() (unpooled, ephemeral).
 * STORE HASHED API keys (SHA-256) in your database, never the raw value.
 *
 * @param prefix - Brand/scope prefix (default 'nope_live'; pick your own e.g. 'sk_live')
 * @param size - Body length in characters (default 40, min 32, max 65536)
 */
export const apiKey = (prefix = 'nope_live', size = 40) => {
  validateTokenPrefix(prefix, 'API key')
  return `${prefix}_${secureToken(size)}`
}

/**
 * Define a typed prefixed-token helper (Stripe-style), e.g. defineToken('sk_live').
 * Same shape as defineId() but the body is produced by secureToken() — no shared
 * pool / cache — and the alphabet is fixed to URL-safe 64-char for stability.
 *
 * @param prefix - Token prefix (e.g. 'sk_live', 'pat')
 * @param opts.size - Body length (default 40, min 32, max 65536)
 * @param opts.separator - Separator between prefix and body (default '_')
 */
export const defineToken = (prefix, opts = {}) => {
  validateTokenPrefix(prefix, 'Token')
  const size = opts.size != null ? opts.size : 40
  if (!Number.isInteger(size) || size < SECURE_TOKEN_MIN || size > SECURE_TOKEN_MAX) {
    throw new Error(`Token size must be an integer between ${SECURE_TOKEN_MIN} and ${SECURE_TOKEN_MAX}`)
  }
  const separator = opts.separator != null ? opts.separator : '_'
  const head = prefix + separator
  const check = makePrefixedCheck(head, size, urlAlphabet)
  return {
    generate: () => head + secureToken(size),
    is: check,
    parse: value => {
      if (!check(value)) return null
      return { prefix, token: value.slice(head.length) }
    },
  }
}

// === orderedId() — sortable 21-char Base58 ID, hot-path string cache ===
// Layout 8 ts | 5 counter | 8 random. Cached ts+counter-head prefix, O(1)
// counter-tail bump, pooled random tail; strictly monotonic across clock
// rewinds and counter overflow.

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_CHARS = /* @__PURE__ */ Array.from(BASE58_ALPHABET)
const BASE58_LAST_CC = BASE58_ALPHABET.charCodeAt(BASE58_ALPHABET.length - 1)
const SUCC_TABLE_SIZE = BASE58_LAST_CC + 1

// SUCCESSOR_CC[charCode_of_alphabet[i]] = charCode_of_alphabet[i+1], 0 for last char.
// Used in the hot path to advance the counter tail in O(1) without modular arithmetic.
const SUCCESSOR_CC = /* @__PURE__ */ (() => {
  const t = new Uint8Array(SUCC_TABLE_SIZE)
  for (let i = 0; i < BASE58_ALPHABET.length - 1; i++) {
    t[BASE58_ALPHABET.charCodeAt(i)] = BASE58_ALPHABET.charCodeAt(i + 1)
  }
  return t
})()

// String-valued successor for carry slicing (empty string = no successor).
const SUCCESSOR = /* @__PURE__ */ (() => {
  const t = new Array(SUCC_TABLE_SIZE).fill('')
  for (let i = 0; i < BASE58_ALPHABET.length - 1; i++) {
    t[BASE58_ALPHABET.charCodeAt(i)] = BASE58_ALPHABET[i + 1]
  }
  return t
})()

// Reverse map for orderedId.parse(): char code → digit value, -1 for invalid.
const BASE58_INV = /* @__PURE__ */ (() => {
  const t = new Int8Array(SUCC_TABLE_SIZE).fill(-1)
  for (let i = 0; i < BASE58_ALPHABET.length; i++) t[BASE58_ALPHABET.charCodeAt(i)] = i
  return t
})()

const FIRST_CHAR = BASE58_ALPHABET[0]
const FIRST_CHAR_CODE = BASE58_ALPHABET.charCodeAt(0)

const ORDERED_TS_LEN = 8                  // 58^8 ≈ 1.28e14 ms (~4,060 years from epoch)
const ORDERED_CTR_LEN = 5                 // 58^5 = 656,356,768 per ms
const ORDERED_CTR_HEAD_LEN = ORDERED_CTR_LEN - 1   // 4 head chars folded into prefix
const ORDERED_RND_LEN = 8                 // 58^8 ≈ 46.9 bits entropy per same-ms ID
const ORDERED_TOTAL_LEN = 21
const ORDERED_PREFIX_LEN = ORDERED_TS_LEN + ORDERED_CTR_HEAD_LEN  // 12
const ORDERED_CTR_HEAD_LAST = ORDERED_PREFIX_LEN - 1               // 11

// Cached hot-path state. timestampCacheMs starts at 0 so the first call always
// takes the full encode path — no separate "uninitialized" sentinel.
let timestampCacheMs = 0
let timestampCachePrefix = ''        // 8-char Base58 ts (live)
let prefixPlusCounterHead = ''       // 12-char string: ts + 4 counter head chars
let counterTailCharCode = FIRST_CHAR_CODE

// Random pool: rejection-sampled Base58 codes, one string per refill; the hot
// path serves 8 chars via substring (same trick as nopeid()'s idPoolStr).
const ORDERED_RND_POOL_SIZE = 16384
const RND_LOOKUP = /* @__PURE__ */ (() => {
  const t = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    const v = i & 63
    t[i] = v < 58 ? BASE58_ALPHABET.charCodeAt(v) : 0
  }
  return t
})()

let orderedRndRaw
let orderedRndCharCodes
let orderedRndPoolStr = ''
let orderedRndCount = 0
let orderedRndPosition = 0

const refillRandom = () => {
  if (!orderedRndRaw) {
    orderedRndRaw = Buffer.allocUnsafe(ORDERED_RND_POOL_SIZE)
    orderedRndCharCodes = Buffer.allocUnsafe(ORDERED_RND_POOL_SIZE)
  }
  fillBuffer(orderedRndRaw)
  const raw = orderedRndRaw
  const out = orderedRndCharCodes
  const lookup = RND_LOOKUP
  let count = 0
  for (let i = 0; i < ORDERED_RND_POOL_SIZE; i++) {
    const cc = lookup[raw[i]]
    if (cc !== 0) out[count++] = cc
  }
  orderedRndCount = count
  // One Buffer.toString per ~16K calls; orderedRndCharCodes stays available as
  // a Uint8Array for seedCounter(), which needs raw char codes.
  orderedRndPoolStr = out.toString('latin1', 0, count)
  orderedRndPosition = 0
}

// Encode a fresh 8-char Base58 ts prefix string. Unrolled — avoids a loop.
const encodeTimestamp = ms => {
  timestampCacheMs = ms
  let t = ms
  const r7 = BASE58_CHARS[t % 58]; t = Math.floor(t / 58)
  const r6 = BASE58_CHARS[t % 58]; t = Math.floor(t / 58)
  const r5 = BASE58_CHARS[t % 58]; t = Math.floor(t / 58)
  const r4 = BASE58_CHARS[t % 58]; t = Math.floor(t / 58)
  const r3 = BASE58_CHARS[t % 58]; t = Math.floor(t / 58)
  const r2 = BASE58_CHARS[t % 58]; t = Math.floor(t / 58)
  const r1 = BASE58_CHARS[t % 58]; t = Math.floor(t / 58)
  const r0 = BASE58_CHARS[t]
  timestampCachePrefix = r0 + r1 + r2 + r3 + r4 + r5 + r6 + r7
}

// Advance the cached ts prefix by `delta` (1..58). Avoids re-encoding the
// entire number — most clock advances are 1-3 ms.
const incrementEncodedTimestamp = delta => {
  const lastCC = timestampCachePrefix.charCodeAt(ORDERED_TS_LEN - 1)
  const newIndex = BASE58_INV[lastCC] + delta
  if (newIndex < 58) {
    timestampCachePrefix = timestampCachePrefix.substring(0, ORDERED_TS_LEN - 1) + BASE58_CHARS[newIndex]
    return
  }
  // Carry: find rightmost char in positions 0..6 that has a successor.
  let carryPos = -1
  for (let i = ORDERED_TS_LEN - 2; i >= 0; i--) {
    if (SUCCESSOR[timestampCachePrefix.charCodeAt(i)]) {
      carryPos = i
      break
    }
  }
  if (carryPos < 0) throw new RangeError('orderedId: timestamp out of Base58 range')
  timestampCachePrefix = timestampCachePrefix.substring(0, carryPos) +
                          SUCCESSOR[timestampCachePrefix.charCodeAt(carryPos)] +
                          FIRST_CHAR.repeat(ORDERED_TS_LEN - 2 - carryPos) +
                          BASE58_CHARS[newIndex - 58]
}

// Re-seed counter head + tail from the random pool on each new ms. The counter is
// RANDOM-seeded (not zeroed) so one observed ID doesn't enumerate the next few;
// strict lex monotonicity is preserved by counter advance + larger ts prefix.
const seedCounter = () => {
  while (orderedRndPosition + ORDERED_CTR_LEN > orderedRndCount) refillRandom()
  const pos = orderedRndPosition
  orderedRndPosition = pos + ORDERED_CTR_LEN
  const cc = orderedRndCharCodes
  prefixPlusCounterHead = timestampCachePrefix +
    String.fromCharCode(cc[pos], cc[pos + 1], cc[pos + 2], cc[pos + 3])
  counterTailCharCode = cc[pos + 4]
}

// Counter tail overflow: increment the counter head with carry; if the head also
// exhausts (58^5 = 656M per ms, unreachable), bump the synthetic clock +1 ms.
const incrementCounterHead = () => {
  const pph = prefixPlusCounterHead
  for (let i = ORDERED_CTR_HEAD_LAST; i >= ORDERED_TS_LEN; i--) {
    const next = SUCCESSOR[pph.charCodeAt(i)]
    if (next) {
      prefixPlusCounterHead = pph.substring(0, i) + next +
                              FIRST_CHAR.repeat(ORDERED_CTR_HEAD_LAST - i)
      counterTailCharCode = FIRST_CHAR_CODE
      return
    }
  }
  encodeTimestamp(timestampCacheMs + 1)
  seedCounter()
}

// Core hot path on the wall clock: orderedId() passes Date.now() per call,
// many() one read per 4096-ID chunk; shared state keeps them jointly monotonic.
const nextOrderedIdWithMs = ms => {
  // Clock rewind handled implicitly: ms <= timestampCacheMs falls to the else
  // branch (counter advance) and reuses the cached larger prefix, so the ts
  // prefix never goes backwards (NTP corrections, VM resumes, container skew).
  if (ms > timestampCacheMs) {
    const delta = ms - timestampCacheMs
    if (delta <= 58) {
      timestampCacheMs = ms
      incrementEncodedTimestamp(delta)
    } else {
      encodeTimestamp(ms)
    }
    seedCounter()
  } else {
    // Same ms — advance counter tail in O(1).
    const nxt = SUCCESSOR_CC[counterTailCharCode]
    if (nxt) counterTailCharCode = nxt
    else incrementCounterHead()
  }
  // 3-operand concat: cached 12-char prefix + 1-char tail + 8-char copied
  // substring — measured fastest on Node 22 vs fromCharCode and four variants.
  if (orderedRndPosition + ORDERED_RND_LEN > orderedRndCount) refillRandom()
  const pos = orderedRndPosition
  orderedRndPosition = pos + ORDERED_RND_LEN
  return prefixPlusCounterHead +
         String.fromCharCode(counterTailCharCode) +
         orderedRndPoolStr.substring(pos, pos + ORDERED_RND_LEN)
}

/**
 * Generate a sortable, strictly-monotonic 21-char Base58 ID (8 ts + 5 counter
 * + 8 random; lexicographic sort matches creation order). Clock rewinds are
 * clamped — never emits a smaller ts prefix — and same-ms counter overflow
 * does a synthetic +1 ms bump: no busy-wait, no recursion.
 */
export const orderedId = () => nextOrderedIdWithMs(Date.now())

/**
 * 21-byte ASCII form of a fresh orderedId() — Base58 char codes in latin1,
 * NOT packed binary; a compact toBytes/fromBytes pair is planned for v2.1.
 */
orderedId.asciiBytes = () => {
  const s = orderedId()
  const out = Buffer.allocUnsafe(ORDERED_TOTAL_LEN)
  for (let i = 0; i < ORDERED_TOTAL_LEN; i++) out[i] = s.charCodeAt(i)
  return out
}

// Decode a Base58 digit range of `id` into a number (parse's ts + counter fields).
const decodeBase58Range = (id, start, len) => {
  let acc = 0
  for (let i = start; i < start + len; i++) {
    const code = id.charCodeAt(i)
    const v = code < SUCC_TABLE_SIZE ? BASE58_INV[code] : -1
    if (v < 0) throw new Error(`Invalid orderedId character at position ${i}: '${id[i]}'`)
    acc = acc * 58 + v
  }
  return acc
}

/**
 * Parse a 21-char orderedId into { timestamp, counter, random }.
 * Throws on length mismatch or non-Base58 characters.
 */
orderedId.parse = id => {
  if (typeof id !== 'string' || id.length !== ORDERED_TOTAL_LEN) {
    throw new Error('Invalid orderedId: must be 21-char Base58 string')
  }
  return {
    timestamp: new Date(decodeBase58Range(id, 0, ORDERED_TS_LEN)),
    counter: decodeBase58Range(id, ORDERED_TS_LEN, ORDERED_CTR_LEN),
    random: id.slice(ORDERED_TS_LEN + ORDERED_CTR_LEN),
  }
}

// Cap a single many() request (same rationale as GENERATE_MANY_MAX).
const ORDERED_MANY_MAX = 1_000_000

/**
 * Generate `count` strictly-monotonic, sortable orderedId()s as an Array.
 * Reads the clock once per 4096-ID chunk, so an embedded timestamp may lag
 * real time (sub-ms in practice) while ordering stays exact; shares state
 * with orderedId(), which continues monotonically after the batch.
 *
 * @param {number} count  Number of IDs. count <= 0 returns []; count > 1,000,000 throws.
 * @returns {string[]}
 */
orderedId.many = count => {
  count |= 0
  if (count <= 0) return []
  if (count > ORDERED_MANY_MAX) {
    throw new Error(`orderedId.many count exceeds maximum (${ORDERED_MANY_MAX})`)
  }
  const out = new Array(count)
  let i = 0
  while (i < count) {
    // One clock read per chunk; within it every ID after the first is a
    // same-ms counter bump, so the same-ms path is inlined. The inlined block
    // mirrors nextOrderedIdWithMs()'s else-branch + build — keep the two in sync.
    const ms = Date.now()
    let end = i + 4096
    if (end > count) end = count
    out[i++] = nextOrderedIdWithMs(ms)
    for (; i < end; i++) {
      const nxt = SUCCESSOR_CC[counterTailCharCode]
      if (nxt) counterTailCharCode = nxt
      else incrementCounterHead()
      if (orderedRndPosition + ORDERED_RND_LEN > orderedRndCount) refillRandom()
      const pos = orderedRndPosition
      orderedRndPosition = pos + ORDERED_RND_LEN
      out[i] = prefixPlusCounterHead +
               String.fromCharCode(counterTailCharCode) +
               orderedRndPoolStr.substring(pos, pos + ORDERED_RND_LEN)
    }
  }
  return out
}

// === Format validators ===

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
// Validate a UUID string; pass a version (1-8) to require that specific version
export const isValidUUID = (id, version) => {
  if (typeof id !== 'string' || !UUID_RE.test(id)) return false
  return version != null ? id[14] === String(version) : true
}

const ULID_RE = /^[0-7][0-9ABCDEFGHJKMNPQRSTVWXYZ]{25}$/i
// Validate a 26-char Crockford Base32 ULID
export const isValidULID = id => typeof id === 'string' && ULID_RE.test(id)

// Default export
export default nopeid
