// nope-id - Secure, fast, and collision-resistant unique ID generator
// A better nanoid alternative with extra features

import { webcrypto as crypto } from 'node:crypto'

// URL-safe alphabet (optimized for compression)
export const urlAlphabet =
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

// Single Set for the default urlAlphabet. isValid() reuses this when the caller
// passes no custom alphabet, instead of building a fresh 64-element Set per call.
const URL_ALPHABET_SET = /* @__PURE__ */ new Set(urlAlphabet)

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
// Byte -> hi/lo ASCII hex char codes, used to write directly into UUID_BUF.
const HEX_HI = /* @__PURE__ */ Uint8Array.from(byteToHex, s => s.charCodeAt(0))
const HEX_LO = /* @__PURE__ */ Uint8Array.from(byteToHex, s => s.charCodeAt(1))

// Reusable 36-byte UUID scratch with hyphens pre-baked at positions 8/13/18/23.
// Each call rewrites only the 32 hex positions, then returns one toString('latin1').
const UUID_BUF = /* @__PURE__ */ Buffer.allocUnsafe(36)
UUID_BUF[8] = UUID_BUF[13] = UUID_BUF[18] = UUID_BUF[23] = 0x2d // '-'

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
  // The hot path then returns idPoolStr.substring(a,b): a SlicedString (O(1),
  // zero-copy) for sizes ≥ 13, and a ~10 ns inline copy below that — both well
  // under Buffer.toString's ~50 ns fixed overhead that used to dominate sizes 2–9.
  idPoolStr = idPool.toString('latin1')
  idPoolOffset = 0
}

// Shared zero-length result for non-positive random() requests (avoids pool corruption)
const EMPTY = Buffer.alloc(0)

// Internal: returns a view INTO the shared pool. Zero-alloc, but the bytes can
// be silently overwritten by the next fillPool() call. Only safe for callers
// that translate-and-discard within a single synchronous step (sortableId,
// ulid, uuidv7, monotonicFactory, objectId).
const randomView = bytes => {
  bytes |= 0
  if (bytes <= 0) return EMPTY
  fillPool(bytes)
  return pool.subarray(poolOffset - bytes, poolOffset)
}

// Public: returns a fresh COPY of random bytes. Holding the result across
// further random()/nopeid()/customAlphabet() calls is safe — pool refills
// cannot overwrite a copy. ~5-15 ns slower than the old view at small sizes,
// but eliminates the foot-gun of users mutating a buffer that the next call
// will overwrite.
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

// Custom random function ID generator (core implementation)
// Uses rejection sampling to eliminate modulo bias
export const customRandom = (alphabet, defaultSize, getRandom) => {
  // Pre-compute constants and char-code lookup table (Uint8Array drives Buffer writes)
  const codes = validateAlphabet(alphabet)
  const len = alphabet.length
  // Calculate mask for rejection sampling (power of 2 - 1)
  const mask = (2 << (31 - Math.clz32((len - 1) | 1))) - 1
  // Increase step to account for rejection sampling overhead
  const step = Math.ceil((1.6 * mask * defaultSize) / len)

  // Closure-scoped pool of pre-mapped, rejection-accepted char codes converted to a
  // flat string. Same trick as nopeid()/idPoolStr: pay Buffer.toString's fixed cost
  // once per refill, return a substring per call (SlicedString or short inline copy).
  let cPool = '', cPoolOffset = 0

  return (size = defaultSize) => {
    if (size <= 0) return ''
    // Cold path for requests larger than the cache: collect into a local buffer
    // without touching the shared cPool. step shrinks as we fill so we don't
    // over-allocate when only a few chars remain.
    if (size > CPOOL_TARGET) {
      const out = Buffer.allocUnsafe(size)
      let n = 0
      while (n < size) {
        const remaining = size - n
        const localStep = Math.max(1, Math.ceil((1.6 * mask * remaining) / len))
        const bytes = getRandom(localStep)
        if (!bytes || bytes.length < localStep) {
          throw new Error('getRandom must return at least the requested number of bytes')
        }
        for (let i = 0; i < localStep && n < size; i++) {
          const idx = bytes[i] & mask
          if (idx < len) out[n++] = codes[idx]
        }
      }
      return out.toString('latin1')
    }
    if (cPoolOffset + size > cPool.length) {
      const buf = Buffer.allocUnsafe(CPOOL_TARGET + step)
      let n = 0
      while (n < CPOOL_TARGET) {
        const bytes = getRandom(step)
        if (!bytes || bytes.length < step) {
          throw new Error('getRandom must return at least the requested number of bytes')
        }
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

// Custom alphabet ID generator factory
export const customAlphabet = (alphabet, defaultSize = 21) => {
  // Same rejection sampling as customRandom, but reads the shared pool directly
  // (no per-call subarray allocation) for speed; this also powers slugId/shortId.
  const codes = validateAlphabet(alphabet)
  const len = alphabet.length
  const mask = (2 << (31 - Math.clz32((len - 1) | 1))) - 1
  const step = Math.ceil((1.6 * mask * defaultSize) / len)

  let cPool = '', cPoolOffset = 0

  return (size = defaultSize) => {
    if (size <= 0) return ''
    // Cold path for huge requests: use a local Buffer + dedicated fillBuffer chunks
    // instead of inflating the shared raw `pool` (which is shaped for sub-pool
    // requests) and instead of touching the cached `cPool`.
    if (size > CPOOL_TARGET) {
      const out = Buffer.allocUnsafe(size)
      const scratch = Buffer.allocUnsafe(Math.min(MAX_POOL_SIZE, Math.max(step, 1024)))
      let n = 0
      while (n < size) {
        fillBuffer(scratch)
        for (let i = 0; i < scratch.length && n < size; i++) {
          const idx = scratch[i] & mask
          if (idx < len) out[n++] = codes[idx]
        }
      }
      return out.toString('latin1')
    }
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
export const nopeid = (size = 21) => {
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

// ULID-like sortable ID with monotonic guarantee (legacy).
// Format: 10 chars timestamp (base32) + 12 chars random (base32) = 22 chars
// Max wait iterations prevents DoS from frozen system clock
//
// @deprecated Prefer orderedId() — fixed 21-char Base58, stronger invariants,
//             explicit counter overflow handling. sortableId() is kept for
//             backward compatibility; sizes < 22 truncate the format and
//             weaken uniqueness guarantees.
const MAX_CLOCK_WAIT_ITERATIONS = 10000

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
    // New millisecond - generate fresh random. Manual loop instead of Array.from(arr, fn)
    // so we don't rely on V8 to hoist the (b => b & 31) literal.
    lastTime = now
    const bytes = randomView(RANDOM_LENGTH)
    lastRandom = new Array(RANDOM_LENGTH)
    for (let i = 0; i < RANDOM_LENGTH; i++) lastRandom[i] = bytes[i] & 31
  }

  // Encode directly into a reusable 22-byte buffer (avoids prepend-style ConsString churn).
  let t = now
  for (let i = 9; i >= 0; i--) { SORT_BUF[i] = CROCKFORD_CODES[t & 31]; t = Math.floor(t / 32) }
  for (let i = 0; i < RANDOM_LENGTH; i++) SORT_BUF[10 + i] = CROCKFORD_CODES[lastRandom[i]]

  if (size >= 22) {
    if (size === 22) return SORT_BUF.toString('latin1', 0, 22)
    // Extend with Crockford Base32 (not urlAlphabet) so the whole ID stays in the
    // documented alphabet; & 31 over random bytes is bias-free (256 / 32 = 8).
    const extraLen = size - 22
    const tail = Buffer.allocUnsafe(extraLen)
    const extra = randomView(extraLen)
    for (let i = 0; i < extraLen; i++) tail[i] = CROCKFORD_CODES[extra[i] & 31]
    return SORT_BUF.toString('latin1', 0, 22) + tail.toString('latin1')
  }
  return SORT_BUF.toString('latin1', 0, size)
}

// Prefixed ID generator
export const prefixedId = (prefix, size = 21, separator = '_') => {
  if (typeof prefix !== 'string') {
    throw new Error('Prefix must be a string')
  }
  return `${prefix}${separator}${nopeid(size)}`
}

// Upper bound on a single generateMany() request. The output is a single
// Array of strings; >1M entries crosses into "you probably want a stream"
// territory and would silently exhaust V8's young-gen.
const GENERATE_MANY_MAX = 1_000_000

// Generate multiple unique IDs at once
export const generateMany = (count, size = 21) => {
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

// Validate if a string is a valid ID for given alphabet
// No early-return on first bad character — avoids the obvious first-bad-char timing
// leak. This is NOT a true constant-time check (Set.has timing is not guaranteed
// uniform across V8 versions), but it prevents the most naive position oracle.
export const isValid = (id, alphabet = urlAlphabet) => {
  if (typeof id !== 'string' || id.length === 0) return false

  // Reuse the hoisted Set for the common (urlAlphabet) case; only allocate when a
  // caller passes a custom alphabet. Set has O(1) lookup either way.
  const charSet = alphabet === urlAlphabet ? URL_ALPHABET_SET : new Set(alphabet)

  let valid = 1
  for (let i = 0; i < id.length; i++) {
    valid &= charSet.has(id[i]) ? 1 : 0
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

// UUID v4 generator. Backed by a string pool of pre-formatted v4 UUIDs: at refill
// time we draw 4096*16 fresh CSPRNG bytes, apply the v4 version + RFC 4122 variant
// bit patches per slot, write 32 hex chars (hyphens are pre-baked once at the slot
// positions 8/13/18/23), then toString once for the whole 144 KiB. Each call is then
// a single substring(start, start+36) — a SlicedString on a flat one-byte parent.
// Entropy is unchanged: every UUID still gets its own 16 CSPRNG bytes and its own
// proper v4 patches.
const UUID_POOL_COUNT = 4096
const UUID_POOL_BYTES = UUID_POOL_COUNT * 36
let uuidPool, uuidPoolStr, uuidPoolOffset, uuidRawScratch
export const uuid = () => {
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
      // Patch version (4) into byte 6 and RFC 4122 variant into byte 8 before hex encoding.
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
export const uuidv7 = () => {
  // randomView is safe here: we mutate the bytes (writeTimestamp48 + version/variant
  // patches) within this synchronous step, then immediately format. The pool region
  // we wrote into is past poolOffset and will not be returned to another caller before
  // the next fillPool refills it.
  const bytes = randomView(16)
  writeTimestamp48(bytes, Date.now())
  bytes[6] = (bytes[6] & 0x0f) | 0x70 // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant RFC 4122
  return bytesToUuid(bytes)
}

// === ULID (spec-compliant, 26 chars: 10 timestamp + 16 random, Crockford Base32) ===

// Module-level scratch buffer reused across ulid() calls — no per-call alloc, and
// toString('latin1', 0, 26) beats String.fromCharCode.apply(null, Uint16Array).
const ULID_BUF = /* @__PURE__ */ Buffer.allocUnsafe(26)

// 26-char ULID. Fresh randomness each call (non-monotonic); use monotonicFactory() for ordering.
export const ulid = (seedTime = Date.now()) => {
  const bytes = randomView(16)
  let ms = seedTime
  for (let i = 9; i >= 0; i--) { ULID_BUF[i] = CROCKFORD_CODES[ms % 32]; ms = Math.floor(ms / 32) }
  for (let i = 0; i < 16; i++) ULID_BUF[10 + i] = CROCKFORD_CODES[bytes[i] & 31]
  return ULID_BUF.toString('latin1', 0, 26)
}

// Monotonic ULID factory with ISOLATED state (does not touch global sortableId state).
// Same/backwards-ms calls increment the 16-char random part as a base-32 counter.
// Closure-scoped scratch buffer is reused; same-ms calls only rewrite the changed
// random-part byte(s) instead of re-encoding the full string.
export const monotonicFactory = () => {
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
    } else {
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
    }
    return out.toString('latin1', 0, 26)
  }
}

// === Snowflake (distributed 64-bit ID, returned as a string) ===

const DEFAULT_SNOWFLAKE_EPOCH = 1288834974657n // Twitter epoch (2010-11-04)

// Factory: each instance owns its sequence/timestamp state (coordination-free per node).
// Layout: 41-bit timestamp | 10-bit nodeId | 12-bit sequence.
export const snowflakeFactory = (options = {}) => {
  const nodeId = BigInt((options.nodeId | 0) & 0x3ff)
  const epoch = options.epoch != null ? BigInt(options.epoch) : DEFAULT_SNOWFLAKE_EPOCH
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

// Decode a snowflake string into { timestamp, nodeId, sequence }
export const decodeSnowflake = (id, epoch = DEFAULT_SNOWFLAKE_EPOCH) => {
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
export const objectId = () => {
  if (oidMachine === null) {
    oidMachine = Array.from(randomView(5))
    const c = randomView(3)
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

// 24-char hex pattern — matches what objectId() actually produces.
// A length-only check let non-hex strings like 'z'.repeat(24) sneak through
// and silently return Invalid Date; this regex rejects them at the boundary.
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
  // is() must enforce the exact body length too: without this check, a single-char
  // 'usr_a' would pass through .startsWith(head) + isValid() even though defineId
  // would never produce it.
  const check = value => {
    if (typeof value !== 'string') return false
    if (!value.startsWith(head)) return false
    const body = value.slice(head.length)
    return body.length === size && isValid(body, alphabet)
  }
  return {
    generate: () => head + gen(),
    is: check,
    parse: value => (check(value) ? { prefix, id: value.slice(head.length) } : null),
  }
}

// === Secure bearer tokens (unpooled, ephemeral) ===
//
// nopeid() returns substrings of a long-lived cached pool string (idPoolStr) for
// throughput. That cache is fine for public IDs, but for bearer secrets (API keys,
// session tokens, password-reset tokens) it means a memory dump may expose tokens
// that have not yet been requested. secureToken() defeats that class of risk:
// each call allocates its own buffer, fills it from CSPRNG, maps to the alphabet,
// then zeros the raw bytes before returning. The returned V8 string itself cannot
// be zeroed — that is a JavaScript limitation, documented in the JSDoc.

const SECURE_TOKEN_MIN = 32

/**
 * Generate a bearer token for security-sensitive use cases in JavaScript
 * environments (URL-safe, 64-char alphabet, bias-free CSPRNG).
 *
 * secureToken() does not cache or pre-generate future tokens; each call allocates
 * its own local buffer, fills it from CSPRNG, maps to the alphabet, and zeros the
 * raw byte buffer before returning. This eliminates the "future-token cache" class
 * of disclosure risk that pooled generators (like nopeid()) inherently carry.
 *
 * NOTE: the returned JavaScript string itself cannot be zeroized — V8 strings are
 * immutable and live in the GC heap until collected. If your threat model requires
 * memory-clearable secrets, keep the bytes as Buffer/Uint8Array and never .toString().
 *
 * Store HASHED tokens in your database (e.g. SHA-256), never the raw token.
 *
 * @param size - Token length in characters (default 48, min 32)
 * @returns A URL-safe random token
 * @throws Error if size is not an integer >= 32
 */
export const secureToken = (size = 48) => {
  if (!Number.isInteger(size) || size < SECURE_TOKEN_MIN) {
    throw new Error(`secureToken size must be an integer >= ${SECURE_TOKEN_MIN}`)
  }
  // Local buffer — bypasses both the shared `pool` and the cached `idPoolStr`.
  const buf = Buffer.allocUnsafe(size)
  fillBuffer(buf)  // direct CSPRNG fill (handles >MAX_POOL_SIZE chunks)
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
 * @param size - Body length in characters (default 40, min 32)
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
 * @param opts.size - Body length (default 40, min 32)
 * @param opts.separator - Separator between prefix and body (default '_')
 */
export const defineToken = (prefix, opts = {}) => {
  validateTokenPrefix(prefix, 'Token')
  const size = opts.size != null ? opts.size : 40
  if (!Number.isInteger(size) || size < SECURE_TOKEN_MIN) {
    throw new Error(`Token size must be an integer >= ${SECURE_TOKEN_MIN}`)
  }
  const separator = opts.separator != null ? opts.separator : '_'
  const head = prefix + separator
  const check = value => {
    if (typeof value !== 'string') return false
    if (!value.startsWith(head)) return false
    const body = value.slice(head.length)
    return body.length === size && isValid(body, urlAlphabet)
  }
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
//
// Layout: 8 ts | 5 counter | 8 random  (lexicographic sort matches creation time).
//
// Hot path design (mirrors sparkid's technique with stronger invariants):
//
//   - Timestamp prefix is cached as a STRING and only re-encoded when the
//     millisecond advances. Same-ms calls reuse it for free.
//   - Counter is split into a 4-char "head" (folded into the cached prefix
//     as `prefixPlusCounterHead`, 12 chars total) and a 1-char "tail" stored
//     as a single char code. Advancing the counter within a ms is one
//     SUCCESSOR_CC lookup; only tail overflow touches the head.
//   - Random tail (8 chars) is rejection-sampled from a Uint8Array char-code
//     pool and pre-built into a flat Latin-1 string at refill time, so the
//     hot path consumes 8 fresh random chars as a single SlicedString
//     substring — no per-call fromCharCode call for the random bytes.
//   - Strict monotonic across clock rewinds (ms falls to the counter-advance
//     branch and reuses the larger cached prefix) and counter overflow
//     (synthetic ms bump, no busy-wait).
//
// We KEEP 5 counter + 8 random (vs sparkid's 6+7) for the extra ~6 bits of
// same-ms random entropy — the format choice from the v1 plan. To match and
// exceed sparkid's throughput we serve the 8 random chars as a substring of
// a pre-built string instead of via fromCharCode(9 args).

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

// Cached hot-path state. timestampCacheMs starts at 0 so the first call's
// (Date.now() > 0) branch always wins and falls into the full encode path —
// no separate "uninitialized" sentinel to test against in the hot path.
let timestampCacheMs = 0
let timestampCachePrefix = ''        // 8-char Base58 ts (live)
let prefixPlusCounterHead = ''       // 12-char string: ts + 4 counter head chars
let counterTailCharCode = FIRST_CHAR_CODE

// Random pool. The raw byte buffer is rejection-sampled to Base58 char codes,
// then materialized as a Latin-1 string ONCE per refill. The hot path serves
// 8 random chars via String.prototype.substring on this pool string — V8
// returns a SlicedString in O(1) for that length, no allocation per call.
// This is the same trick `nopeid()` uses with `idPoolStr`.
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
  // Pay the Buffer.toString cost ONCE per ~16K calls — the hot path returns a
  // SlicedString substring. orderedRndCharCodes remains available as a
  // Uint8Array for seedCounter() which needs raw char codes.
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

// Re-seed counter head (4 chars) + tail (1 char code) from the random pool.
// Called whenever the ms boundary advances. Counter is RANDOM-seeded, not
// reset to zero, so an observer of one ID cannot trivially enumerate the
// next handful by guessing tail++. Strict lex monotonicity is still preserved
// (within-ms by counter advance, across-ms by the strictly larger ts prefix).
const seedCounter = () => {
  while (orderedRndPosition + ORDERED_CTR_LEN > orderedRndCount) refillRandom()
  const pos = orderedRndPosition
  orderedRndPosition = pos + ORDERED_CTR_LEN
  const cc = orderedRndCharCodes
  prefixPlusCounterHead = timestampCachePrefix +
    String.fromCharCode(cc[pos], cc[pos + 1], cc[pos + 2], cc[pos + 3])
  counterTailCharCode = cc[pos + 4]
}

// Counter tail overflow: increment the 4-char counter head with carry.
// If the head also exhausts (5-char counter at 58^5 = 656M, unreachable in
// practice within a single ms), bump the synthetic clock forward by 1 ms.
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

// nextOrderedIdWithMs(ms) is the core hot path, parameterized on the wall clock.
// orderedId() passes a fresh Date.now() on every call, so the embedded timestamp
// is accurate to the call. orderedId.many() passes one clock read per batch
// (refreshed every 4096 IDs), amortizing Date.now() across the batch with no
// background timer and no change to the per-call path. Both entry points share
// the module-level cache state below, so a many() batch leaves the generator
// strictly monotonic for any orderedId() that follows.
const nextOrderedIdWithMs = ms => {
  // Clock rewind is handled implicitly: when ms <= timestampCacheMs (whether
  // because the clock went backwards or because we're still in the same ms),
  // we fall to the else branch, advance the counter, and reuse the cached
  // prefix. Result: the emitted ID's ts prefix is never smaller than one we've
  // already returned, even across NTP corrections / VM resumes / container
  // skews. No explicit clamp needed in the hot path.
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
  // Build the 21-char ID = 12-char cached prefix + 1-char counter tail + 8
  // random chars. The 8-char random substring is copied into a fresh one-byte
  // SeqString — V8 only returns a zero-copy SlicedString for length >= 13, so
  // an 8-char slice is a small CopyChars, not a view — and the three operands
  // are then joined via ConsStrings. This 3-operand form was MEASURED fastest
  // on Node 22 / V8 13.x: a single 9-arg String.fromCharCode and four other
  // hot-path variants all tied or regressed in a multi-process A/B against it.
  if (orderedRndPosition + ORDERED_RND_LEN > orderedRndCount) refillRandom()
  const pos = orderedRndPosition
  orderedRndPosition = pos + ORDERED_RND_LEN
  return prefixPlusCounterHead +
         String.fromCharCode(counterTailCharCode) +
         orderedRndPoolStr.substring(pos, pos + ORDERED_RND_LEN)
}

/**
 * Generate a sortable, strictly-monotonic 21-char Base58 ID.
 * Layout: 8 ts + 5 counter + 8 random. Lexicographic sort matches creation order.
 *
 * Invariants:
 *  - Strict monotonic (b > a) within and across milliseconds.
 *  - Clock rewind (Date.now() goes backwards) is clamped — never emits a
 *    timestamp prefix smaller than one already returned.
 *  - Same-ms counter overflow is handled by a synthetic +1 ms bump. No
 *    busy-wait loop, no recursion, no event-loop block.
 */
export const orderedId = () => nextOrderedIdWithMs(Date.now())

/**
 * 21-byte ASCII representation of a fresh orderedId() — Base58 char codes in
 * latin1 (one byte per character). This is NOT a packed binary representation;
 * Base58 does not pack cleanly into bytes. A compact toBytes/fromBytes pair is
 * planned for v2.1.
 */
orderedId.asciiBytes = () => {
  const s = orderedId()
  const out = Buffer.allocUnsafe(ORDERED_TOTAL_LEN)
  for (let i = 0; i < ORDERED_TOTAL_LEN; i++) out[i] = s.charCodeAt(i)
  return out
}

/**
 * Parse a 21-char orderedId into { timestamp, counter, random }.
 * Throws on length mismatch or non-Base58 characters.
 */
orderedId.parse = id => {
  if (typeof id !== 'string' || id.length !== ORDERED_TOTAL_LEN) {
    throw new Error('Invalid orderedId: must be 21-char Base58 string')
  }
  let ts = 0
  for (let i = 0; i < ORDERED_TS_LEN; i++) {
    const code = id.charCodeAt(i)
    const v = code < SUCC_TABLE_SIZE ? BASE58_INV[code] : -1
    if (v < 0) throw new Error(`Invalid orderedId character at position ${i}: '${id[i]}'`)
    ts = ts * 58 + v
  }
  let ctr = 0
  for (let i = ORDERED_TS_LEN; i < ORDERED_TS_LEN + ORDERED_CTR_LEN; i++) {
    const code = id.charCodeAt(i)
    const v = code < SUCC_TABLE_SIZE ? BASE58_INV[code] : -1
    if (v < 0) throw new Error(`Invalid orderedId character at position ${i}: '${id[i]}'`)
    ctr = ctr * 58 + v
  }
  return {
    timestamp: new Date(ts),
    counter: ctr,
    random: id.slice(ORDERED_TS_LEN + ORDERED_CTR_LEN),
  }
}

// Upper bound on a single orderedId.many() request. Same rationale as
// GENERATE_MANY_MAX: the result is one Array, and past ~1M entries you want a
// stream, not a megabyte-scale array held live in young-gen.
const ORDERED_MANY_MAX = 1_000_000

/**
 * Generate `count` strictly-monotonic, sortable orderedId()s as an Array.
 *
 * Reads the wall clock once at the start of the batch, then only every 4096
 * IDs, so the per-call Date.now() cost is amortized across the whole batch with
 * NO background timer and NO change to the default orderedId() path. IDs within
 * a batch are separated by the strictly-incrementing counter, so the result is
 * strictly monotonic and sorts in creation order. Because the clock is sampled
 * at most once per 4096 IDs, an embedded timestamp may lag real time by however
 * long it takes to emit up to 4096 IDs (sub-millisecond in practice); ordering
 * is always exact. Shares state with orderedId(), so a following orderedId()
 * continues monotonically from where the batch left off.
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
    // One clock read per 4096-ID chunk. Within a chunk `ms` is constant, so
    // only the first ID can advance the timestamp / reseed the counter; every
    // later ID is provably a same-ms counter bump. We emit the first via the
    // shared nextOrderedIdWithMs() and inline the same-ms path for the rest,
    // dropping the per-ID function call and the `ms > timestampCacheMs` branch.
    // The inlined block mirrors nextOrderedIdWithMs()'s else-branch + build —
    // keep the two in sync. Measured ~+4% vs calling nextOrderedIdWithMs() per
    // ID (multi-process A/B, Node 22); the per-call orderedId() path is left
    // untouched, so it cannot regress.
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
