// nope-id - Browser version (Web Crypto API)
// Secure, fast, and collision-resistant unique ID generator

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

// Crockford's Base32 alphabet for sortable IDs
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
// Char codes (all ASCII, fit in a byte) used to write Crockford ids straight into Uint8Arrays.
const CROCKFORD_CODES = /* @__PURE__ */ Uint8Array.from(CROCKFORD_ALPHABET, c => c.charCodeAt(0))

// Reusable 22-byte sortableId scratch (10 ts + 12 random).
const SORT_BUF = /* @__PURE__ */ new Uint8Array(22)

// Precomputed byte -> 2-char hex (faster + clearer than toString(16).padStart per byte)
const byteToHex = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'))
// Byte -> hi/lo ASCII hex char codes for direct UUID_BUF writes.
const HEX_HI = /* @__PURE__ */ Uint8Array.from(byteToHex, s => s.charCodeAt(0))
const HEX_LO = /* @__PURE__ */ Uint8Array.from(byteToHex, s => s.charCodeAt(1))

// Reusable 36-byte UUID scratch with hyphens pre-baked at 8/13/18/23.
const UUID_BUF = /* @__PURE__ */ new Uint8Array(36)
UUID_BUF[8] = UUID_BUF[13] = UUID_BUF[18] = UUID_BUF[23] = 0x2d

// Format 16 bytes as a hyphenated UUID by writing 32 hex char codes into UUID_BUF
// then one-shot decoding it — beats 16 string lookups + 4 ConsString joins.
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
  return ID_DECODER.decode(UUID_BUF)
}

// Pool management for reduced crypto calls
// Max pool size is 65536 (crypto.getRandomValues limit)
const POOL_SIZE_MULTIPLIER = 128
const MAX_POOL_SIZE = 65536
let pool = new Uint8Array(0)
let poolOffset = 0

// Fill buffer in chunks if larger than MAX_POOL_SIZE
const fillBuffer = buffer => {
  const len = buffer.length
  for (let offset = 0; offset < len; offset += MAX_POOL_SIZE) {
    const chunk = buffer.subarray(offset, Math.min(offset + MAX_POOL_SIZE, len))
    crypto.getRandomValues(chunk)
  }
}

const fillPool = bytes => {
  if (pool.length < bytes) {
    const poolSize = Math.min(bytes * POOL_SIZE_MULTIPLIER, MAX_POOL_SIZE)
    pool = new Uint8Array(Math.max(poolSize, bytes))
    fillBuffer(pool)
    poolOffset = 0
  } else if (poolOffset + bytes > pool.length) {
    fillBuffer(pool)
    poolOffset = 0
  }
  poolOffset += bytes
}

// Pre-computed char codes of the URL-safe alphabet, indexed by (byte & 63).
// Drives both the cold path and the 16-bit batch refill table below.
const URL_ALPHABET_CODES = /* @__PURE__ */ Uint8Array.from(urlAlphabet, c => c.charCodeAt(0))

// Cached latin1 decoder. Browser equivalent of Node's Buffer.toString('latin1'):
// turns a one-byte view into a string in a single allocation, replacing the per-character
// ConsString chain produced by `id += alphabet[...]`.
const ID_DECODER = /* @__PURE__ */ new TextDecoder('latin1')

// Dedicated pool for nopeid(): CSPRNG bytes translated in place to alphabet char codes.
// Each call is then a single TextDecoder.decode(subarray) call. Kept separate from `pool`
// (raw bytes for random()/customAlphabet()/uuid()/etc.).
let idPool, idPoolOffset, idPoolView, idPoolCodes16, idPoolStr

const fillIdPool = () => {
  if (!idPool) {
    idPool = new Uint8Array(MAX_POOL_SIZE)
    idPoolView = new Uint16Array(idPool.buffer, idPool.byteOffset, MAX_POOL_SIZE >> 1)
    // 64 KiB Uint16Array table maps any 16-bit value (two random bytes) directly to
    // two translated alphabet codes, halving the refill iteration count. Endian-agnostic
    // because each output byte still corresponds to its own input byte.
    idPoolCodes16 = new Uint16Array(0x10000)
    for (let i = 0; i < 0x10000; i++) {
      idPoolCodes16[i] = (URL_ALPHABET_CODES[(i >> 8) & 63] << 8) | URL_ALPHABET_CODES[i & 63]
    }
  }
  fillBuffer(idPool)
  const view = idPoolView
  const table = idPoolCodes16
  for (let i = 0; i < view.length; i++) view[i] = table[view[i]]
  // Pay TextDecoder's fixed cost once per refill; hot path returns idPoolStr.substring().
  idPoolStr = ID_DECODER.decode(idPool)
  idPoolOffset = 0
}

// Shared zero-length result for non-positive random() requests (avoids pool corruption)
const EMPTY = new Uint8Array(0)

// Internal view into the shared pool — zero-alloc, but bytes may be silently
// overwritten by a subsequent fillPool(). Safe only inside a single synchronous
// translate-and-discard step (sortableId, ulid, uuidv7, monotonicFactory, objectId).
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
  return new Uint8Array(pool.subarray(poolOffset - bytes, poolOffset))
}

// Factory-time alphabet validation in a single pass: empty/oversize/non-Latin-1/
// duplicate chars. Returns a precomputed Uint8Array of char codes.
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
  const codes = validateAlphabet(alphabet)
  const len = alphabet.length
  const mask = (2 << (31 - Math.clz32((len - 1) | 1))) - 1
  const step = Math.ceil((1.6 * mask * defaultSize) / len)

  let cPool = '', cPoolOffset = 0

  return (size = defaultSize) => {
    if (size <= 0) return ''
    // Cold path for huge requests: don't touch the cached cPool.
    if (size > CPOOL_TARGET) {
      const out = new Uint8Array(size)
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
      return ID_DECODER.decode(out)
    }
    if (cPoolOffset + size > cPool.length) {
      const buf = new Uint8Array(CPOOL_TARGET + step)
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
      cPool = ID_DECODER.decode(buf.subarray(0, n))
      cPoolOffset = 0
    }
    const start = cPoolOffset
    cPoolOffset += size
    return cPool.substring(start, cPoolOffset)
  }
}

// Custom alphabet ID generator factory
export const customAlphabet = (alphabet, defaultSize = 21) => {
  const codes = validateAlphabet(alphabet)
  const len = alphabet.length
  const mask = (2 << (31 - Math.clz32((len - 1) | 1))) - 1
  const step = Math.ceil((1.6 * mask * defaultSize) / len)

  let cPool = '', cPoolOffset = 0

  return (size = defaultSize) => {
    if (size <= 0) return ''
    // Cold path: large request — local buffer, don't inflate shared `pool` or cached `cPool`.
    if (size > CPOOL_TARGET) {
      const out = new Uint8Array(size)
      const scratch = new Uint8Array(Math.min(MAX_POOL_SIZE, Math.max(step, 1024)))
      let n = 0
      while (n < size) {
        fillBuffer(scratch)
        for (let i = 0; i < scratch.length && n < size; i++) {
          const idx = scratch[i] & mask
          if (idx < len) out[n++] = codes[idx]
        }
      }
      return ID_DECODER.decode(out)
    }
    if (cPoolOffset + size > cPool.length) {
      const buf = new Uint8Array(CPOOL_TARGET + step)
      let n = 0
      while (n < CPOOL_TARGET) {
        fillPool(step)
        const base = poolOffset - step
        for (let i = 0; i < step; i++) {
          const idx = pool[base + i] & mask
          if (idx < len) buf[n++] = codes[idx]
        }
      }
      cPool = ID_DECODER.decode(buf.subarray(0, n))
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
    const raw = new Uint8Array(size)
    fillBuffer(raw)
    for (let i = 0; i < size; i++) raw[i] = URL_ALPHABET_CODES[raw[i] & 63]
    return ID_DECODER.decode(raw)
  }
  if (!idPool || idPoolOffset + size > MAX_POOL_SIZE) fillIdPool()
  // Substring of the cached idPoolStr — much faster than re-decoding bytes per call.
  const start = idPoolOffset
  idPoolOffset += size
  return idPoolStr.substring(start, idPoolOffset)
}

// === COLLISION-RESISTANT FEATURES ===

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

// ULID-like sortable ID with monotonic guarantee (legacy).
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
  // Clock rewind clamp — see index.js for rationale.
  if (now < lastTime) now = lastTime

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
    const bytes = randomView(RANDOM_LENGTH)
    lastRandom = new Array(RANDOM_LENGTH)
    for (let i = 0; i < RANDOM_LENGTH; i++) lastRandom[i] = bytes[i] & 31
  }

  // Encode directly into the reusable 22-byte scratch buffer.
  let t = now
  for (let i = 9; i >= 0; i--) { SORT_BUF[i] = CROCKFORD_CODES[t & 31]; t = Math.floor(t / 32) }
  for (let i = 0; i < RANDOM_LENGTH; i++) SORT_BUF[10 + i] = CROCKFORD_CODES[lastRandom[i]]

  if (size >= 22) {
    if (size === 22) return ID_DECODER.decode(SORT_BUF)
    const extraLen = size - 22
    const tail = new Uint8Array(extraLen)
    const extra = randomView(extraLen)
    for (let i = 0; i < extraLen; i++) tail[i] = CROCKFORD_CODES[extra[i] & 31]
    return ID_DECODER.decode(SORT_BUF) + ID_DECODER.decode(tail)
  }
  return ID_DECODER.decode(SORT_BUF.subarray(0, size))
}

// Prefixed ID generator
export const prefixedId = (prefix, size = 21, separator = '_') => {
  if (typeof prefix !== 'string') {
    throw new Error('Prefix must be a string')
  }
  return `${prefix}${separator}${nopeid(size)}`
}

// Generate multiple unique IDs
const GENERATE_MANY_MAX = 1_000_000

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

// Validate ID
// No early-return on first bad char — avoids the obvious first-bad-char timing
// leak. This is NOT a true constant-time check (V8 Set.has timing varies); it
// just blocks the most naive position oracle.
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

// Calculate collision probability
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
  // Unclamped float drives the statistical metrics (Infinity for huge spaces = correct limits)
  const possibleIdsExact = Number(possibleIdsBig)

  return {
    totalPossible: possibleIds,
    totalPossibleBigInt: possibleIdsBig,
    // -Math.expm1(x) computes 1 - exp(x) accurately for x near 0; the naive
    // 1 - exp(x) loses precision and reports 0 for safe id sizes.
    probabilityForBillion: -Math.expm1((-1e9 * (1e9 - 1)) / (2 * possibleIdsExact)),
    safeCount: Math.sqrt(2 * possibleIdsExact * Math.log(2)),
    yearsFor1Percent: Math.sqrt(2 * possibleIdsExact * 0.01) / (365.25 * 24 * 60 * 60 * 1000),
  }
}

// Async version
export const nopeidAsync = async (size = 21) => {
  return nopeid(size)
}

// UUID v4 generator. Backed by a string pool of pre-formatted v4 UUIDs: at refill
// time we draw 4096*16 fresh CSPRNG bytes, apply the v4 version + RFC 4122 variant
// patches per slot, write 32 hex chars (hyphens pre-baked at 8/13/18/23), then
// TextDecoder.decode once for the whole 144 KiB. Each call is then a single
// substring(start, start+36) — entropy unchanged (122 random bits per UUID).
const UUID_POOL_COUNT = 4096
const UUID_POOL_BYTES = UUID_POOL_COUNT * 36
let uuidPool, uuidPoolStr, uuidPoolOffset, uuidRawScratch
export const uuid = () => {
  if (!uuidPool || uuidPoolOffset >= UUID_POOL_BYTES) {
    if (!uuidPool) {
      uuidPool = new Uint8Array(UUID_POOL_BYTES)
      for (let k = 0; k < UUID_POOL_COUNT; k++) {
        const o = k * 36
        uuidPool[o + 8] = uuidPool[o + 13] = uuidPool[o + 18] = uuidPool[o + 23] = 0x2d
      }
      uuidRawScratch = new Uint8Array(UUID_POOL_COUNT * 16)
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
    uuidPoolStr = ID_DECODER.decode(uuidPool)
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

// Fingerprint generator
let fingerprint = null
export const getFingerprint = () => {
  if (fingerprint === null) {
    fingerprint = nopeid(4)
  }
  return fingerprint
}

// Distributed-safe ID
const DISTRIBUTED_ID_MIN = 16

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
  // randomView is safe: we mutate and immediately format within one synchronous step.
  const bytes = randomView(16)
  writeTimestamp48(bytes, Date.now())
  bytes[6] = (bytes[6] & 0x0f) | 0x70 // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant RFC 4122
  return bytesToUuid(bytes)
}

// === ULID (spec-compliant, 26 chars: 10 timestamp + 16 random, Crockford Base32) ===

// Module-level scratch reused across ulid() calls.
const ULID_BUF = /* @__PURE__ */ new Uint8Array(26)

// 26-char ULID. Fresh randomness each call (non-monotonic); use monotonicFactory() for ordering.
export const ulid = (seedTime = Date.now()) => {
  const bytes = randomView(16)
  let ms = seedTime
  for (let i = 9; i >= 0; i--) { ULID_BUF[i] = CROCKFORD_CODES[ms % 32]; ms = Math.floor(ms / 32) }
  for (let i = 0; i < 16; i++) ULID_BUF[10 + i] = CROCKFORD_CODES[bytes[i] & 31]
  return ID_DECODER.decode(ULID_BUF)
}

// Monotonic ULID factory with ISOLATED state (does not touch global sortableId state).
// Closure-scoped scratch reused; same-ms calls rewrite only changed random-part bytes.
export const monotonicFactory = () => {
  let lastTime = 0
  let lastRand = []
  const out = new Uint8Array(26)
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
      return ID_DECODER.decode(out)
    }
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
    return ID_DECODER.decode(out)
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

// Extract the creation Date from an ObjectId (first 4 bytes = seconds)
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/

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
// See index.js for full JSDoc rationale.

const SECURE_TOKEN_MIN = 32

export const secureToken = (size = 48) => {
  if (!Number.isInteger(size) || size < SECURE_TOKEN_MIN) {
    throw new Error(`secureToken size must be an integer >= ${SECURE_TOKEN_MIN}`)
  }
  const buf = new Uint8Array(size)
  fillBuffer(buf)
  for (let i = 0; i < size; i++) {
    buf[i] = URL_ALPHABET_CODES[buf[i] & 63]
  }
  const token = ID_DECODER.decode(buf)
  buf.fill(0)
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

export const apiKey = (prefix = 'nope_live', size = 40) => {
  validateTokenPrefix(prefix, 'API key')
  return `${prefix}_${secureToken(size)}`
}

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
// See index.js for the full architecture / rationale comment.

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_CHARS = /* @__PURE__ */ Array.from(BASE58_ALPHABET)
const BASE58_LAST_CC = BASE58_ALPHABET.charCodeAt(BASE58_ALPHABET.length - 1)
const SUCC_TABLE_SIZE = BASE58_LAST_CC + 1

const SUCCESSOR_CC = /* @__PURE__ */ (() => {
  const t = new Uint8Array(SUCC_TABLE_SIZE)
  for (let i = 0; i < BASE58_ALPHABET.length - 1; i++) {
    t[BASE58_ALPHABET.charCodeAt(i)] = BASE58_ALPHABET.charCodeAt(i + 1)
  }
  return t
})()

const SUCCESSOR = /* @__PURE__ */ (() => {
  const t = new Array(SUCC_TABLE_SIZE).fill('')
  for (let i = 0; i < BASE58_ALPHABET.length - 1; i++) {
    t[BASE58_ALPHABET.charCodeAt(i)] = BASE58_ALPHABET[i + 1]
  }
  return t
})()

const BASE58_INV = /* @__PURE__ */ (() => {
  const t = new Int8Array(SUCC_TABLE_SIZE).fill(-1)
  for (let i = 0; i < BASE58_ALPHABET.length; i++) t[BASE58_ALPHABET.charCodeAt(i)] = i
  return t
})()

const FIRST_CHAR = BASE58_ALPHABET[0]
const FIRST_CHAR_CODE = BASE58_ALPHABET.charCodeAt(0)

const ORDERED_TS_LEN = 8
const ORDERED_CTR_LEN = 5
const ORDERED_CTR_HEAD_LEN = ORDERED_CTR_LEN - 1
const ORDERED_RND_LEN = 8
const ORDERED_TOTAL_LEN = 21
const ORDERED_PREFIX_LEN = ORDERED_TS_LEN + ORDERED_CTR_HEAD_LEN  // 12
const ORDERED_CTR_HEAD_LAST = ORDERED_PREFIX_LEN - 1               // 11

let timestampCacheMs = 0
let timestampCachePrefix = ''
let prefixPlusCounterHead = ''
let counterTailCharCode = FIRST_CHAR_CODE

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
    orderedRndRaw = new Uint8Array(ORDERED_RND_POOL_SIZE)
    orderedRndCharCodes = new Uint8Array(ORDERED_RND_POOL_SIZE)
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
  // Pre-materialize the pool as a Latin-1 string so the hot path can serve
  // 8 random chars via SlicedString substring (zero alloc) instead of
  // fromCharCode per call.
  orderedRndPoolStr = ID_DECODER.decode(out.subarray(0, count))
  orderedRndPosition = 0
}

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

const incrementEncodedTimestamp = delta => {
  const lastCC = timestampCachePrefix.charCodeAt(ORDERED_TS_LEN - 1)
  const newIndex = BASE58_INV[lastCC] + delta
  if (newIndex < 58) {
    timestampCachePrefix = timestampCachePrefix.substring(0, ORDERED_TS_LEN - 1) + BASE58_CHARS[newIndex]
    return
  }
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

const seedCounter = () => {
  while (orderedRndPosition + ORDERED_CTR_LEN > orderedRndCount) refillRandom()
  const pos = orderedRndPosition
  orderedRndPosition = pos + ORDERED_CTR_LEN
  const cc = orderedRndCharCodes
  prefixPlusCounterHead = timestampCachePrefix +
    String.fromCharCode(cc[pos], cc[pos + 1], cc[pos + 2], cc[pos + 3])
  counterTailCharCode = cc[pos + 4]
}

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
// orderedId() passes a fresh Date.now() per call (timestamp accurate to the
// call); orderedId.many() passes one clock read per batch (refreshed every 4096
// IDs) to amortize Date.now() with no background timer. Shared module state, so
// a many() batch leaves the generator monotonic for the next orderedId().
const nextOrderedIdWithMs = ms => {
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
    const nxt = SUCCESSOR_CC[counterTailCharCode]
    if (nxt) counterTailCharCode = nxt
    else incrementCounterHead()
  }
  // 3-operand concat with a SlicedString right side — measured fastest
  // on Node 22 (V8 13.x). See index.js hot-path comment for details.
  if (orderedRndPosition + ORDERED_RND_LEN > orderedRndCount) refillRandom()
  const pos = orderedRndPosition
  orderedRndPosition = pos + ORDERED_RND_LEN
  return prefixPlusCounterHead +
         String.fromCharCode(counterTailCharCode) +
         orderedRndPoolStr.substring(pos, pos + ORDERED_RND_LEN)
}

// Sortable, strictly-monotonic 21-char Base58 ID (8 ts + 5 counter + 8 random).
export const orderedId = () => nextOrderedIdWithMs(Date.now())

orderedId.asciiBytes = () => {
  const s = orderedId()
  const out = new Uint8Array(ORDERED_TOTAL_LEN)
  for (let i = 0; i < ORDERED_TOTAL_LEN; i++) out[i] = s.charCodeAt(i)
  return out
}

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
  let ms = Date.now()
  for (let i = 0; i < count; i++) {
    if ((i & 4095) === 4095) ms = Date.now()
    out[i] = nextOrderedIdWithMs(ms)
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

export default nopeid
