// nope-id - Secure, fast, and collision-resistant unique ID generator
// A better nanoid alternative with extra features

import { randomFillSync } from 'node:crypto'

// URL-safe alphabet (optimized for compression)
export const urlAlphabet =
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

// 256-entry membership table for the default urlAlphabet. isValid() indexes it
// by charCodeAt: no per-char single-character string allocation like Set.has(id[i]).
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
// per-call cap, thinner wrapper, so no chunk loop is needed.
const fillBuffer = randomFillSync

// Callers pass bytes <= MAX_POOL_SIZE (larger requests take oneShotRandom), so the
// shared pool never grows past 64 KiB.
const fillPool = bytes => {
  if (!pool || pool.length < bytes) {
    pool = Buffer.allocUnsafe(Math.min(bytes * POOL_SIZE_MULTIPLIER, MAX_POOL_SIZE))
    fillBuffer(pool)
    poolOffset = 0
  } else if (poolOffset + bytes > pool.length) {
    fillBuffer(pool)
    poolOffset = 0
  }
  poolOffset += bytes
}

// Fresh CSPRNG buffer for requests bigger than the pool. Growing the shared pool
// instead would pin that memory, and its refill cost, for the process lifetime.
const oneShotRandom = bytes => {
  const out = Buffer.allocUnsafe(bytes)
  fillBuffer(out)
  return out
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
  if (bytes > MAX_POOL_SIZE) return oneShotRandom(bytes)
  fillPool(bytes)
  return pool.subarray(poolOffset - bytes, poolOffset)
}

// Public: returns a fresh COPY. Safe to retain across subsequent
// random()/nopeid()/customAlphabet() calls.
export const random = bytes => {
  bytes |= 0
  if (bytes <= 0) return EMPTY
  if (bytes > MAX_POOL_SIZE) return oneShotRandom(bytes)
  fillPool(bytes)
  // Copy straight out of the pool: Buffer.from(pool.subarray()) would build a
  // throwaway view first (~1.3-1.4x slower for small requests).
  const out = Buffer.allocUnsafe(bytes)
  pool.copy(out, 0, poolOffset - bytes, poolOffset)
  return out
}

// Factory-time alphabet validation: empty, non-string, oversize, non-Latin-1, and
// duplicate chars are all caught here. Returns the precomputed char-code lookup table
// that downstream rejection sampling uses to write into Buffers without per-call charCodeAt.
const validateAlphabet = alphabet => {
  if (!alphabet) {
    throw new Error('Alphabet cannot be empty')
  }
  // A non-string (e.g. a number) has no usable length: without this check it would
  // reach the tiers and throw an internal RangeError (and hang the browser build).
  if (typeof alphabet !== 'string') {
    throw new Error('Alphabet must be a string')
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
const ERR_GET_RANDOM_SHORT = 'getRandom must return at least the requested number of bytes'
const ERR_GET_RANDOM_STUCK = 'getRandom returned no bytes usable for this alphabet'

// Byte rejection with a cutoff: bytes below cutoff (the largest multiple of the
// alphabet length that fits a byte) map uniformly through byteCodes[b] =
// codes[b % len]; the rest are rejected. One compare + one lookup per byte, no
// mask or modulo, and far fewer rejections than a power-of-2 mask for most lengths.
const byteCodesFor = (codes, cutoff) => {
  const byteCodes = new Uint8Array(256)
  for (let b = 0; b < cutoff; b++) byteCodes[b] = codes[b % codes.length]
  return byteCodes
}

export const customRandom = (alphabet, defaultSize, getRandom) => {
  const codes = validateAlphabet(alphabet)
  const len = alphabet.length
  const mask = (2 << (31 - Math.clz32((len - 1) | 1))) - 1

  // Closure-scoped pool of pre-mapped, rejection-accepted char codes converted to a
  // flat string. Same trick as nopeid()/idPoolStr: pay Buffer.toString's fixed cost
  // once per refill, return a substring per call (SlicedString or short inline copy).
  let cPool = '', cPoolOffset = 0

  // Power-of-2 length: the mask is exact and every byte maps, so a pass is a
  // branch-free translate (no rejection, so no stuck generator either). Requests
  // stay <= CPOOL_TARGET bytes, webcrypto-safe, cold path included.
  if (mask === len - 1) {
    const take = (out, start, count) => {
      const bytes = getRandom(count)
      if (!bytes || bytes.length < count) {
        throw new Error(ERR_GET_RANDOM_SHORT)
      }
      for (let i = 0; i < count; i++) out[start + i] = codes[bytes[i] & mask]
    }
    return (size = defaultSize) => {
      size |= 0
      if (size <= 0) return ''
      // Cold path for requests larger than the cache: a one-shot local buffer.
      if (size > CPOOL_TARGET) {
        const out = Buffer.allocUnsafe(size)
        for (let n = 0; n < size; n += CPOOL_TARGET) take(out, n, Math.min(CPOOL_TARGET, size - n))
        return out.toString('latin1')
      }
      if (cPoolOffset + size > cPool.length) {
        const buf = Buffer.allocUnsafe(CPOOL_TARGET)
        take(buf, 0, CPOOL_TARGET)
        cPool = buf.toString('latin1')
        cPoolOffset = 0
      }
      const start = cPoolOffset
      cPoolOffset += size
      return cPool.substring(start, cPoolOffset)
    }
  }

  // Other lengths: cutoff byte rejection (byteCodesFor). A 17-char alphabet keeps
  // 99.6% of bytes this way, against 53% under a power-of-2 mask.
  const cutoff = 256 - (256 % len)
  const byteCodes = byteCodesFor(codes, cutoff)
  // One bulk getRandom per pass instead of ~1000+ tiny step-sized calls, with
  // 1.6x headroom toward CPOOL_TARGET, never more than 65536 bytes (webcrypto-safe).
  const passLen = Math.min(65536, Math.ceil((1.6 * 256 * CPOOL_TARGET) / cutoff))

  // One getRandom(passLen) pass, mapped into out[n..limit); returns the new n.
  // A pass that accepts nothing means the generator is broken (e.g. constant
  // output): a working RNG never rejects all passLen bytes, and without this check
  // the caller would loop forever. The n < limit guard keeps a top-up pass from
  // writing past `out` (typed-array writes past the end are silent no-ops, which
  // would desync n from the chars actually stored).
  const fillPass = (out, n, limit) => {
    const bytes = getRandom(passLen)
    if (!bytes || bytes.length < passLen) {
      throw new Error(ERR_GET_RANDOM_SHORT)
    }
    const start = n
    for (let i = 0; i < passLen && n < limit; i++) {
      const b = bytes[i]
      if (b < cutoff) out[n++] = byteCodes[b]
    }
    if (n === start) throw new Error(ERR_GET_RANDOM_STUCK)
    return n
  }

  return (size = defaultSize) => {
    size |= 0
    if (size <= 0) return ''
    // Cold path for requests larger than the cache: collect into a local buffer
    // without touching the shared cPool.
    if (size > CPOOL_TARGET) {
      const out = Buffer.allocUnsafe(size)
      let n = 0
      while (n < size) n = fillPass(out, n, size)
      return out.toString('latin1')
    }
    if (cPoolOffset + size > cPool.length) {
      const buf = Buffer.allocUnsafe(passLen)
      let n = 0
      while (n < CPOOL_TARGET) n = fillPass(buf, n, passLen)
      cPool = buf.toString('latin1', 0, n)
      cPoolOffset = 0
    }
    const start = cPoolOffset
    cPoolOffset += size
    return cPool.substring(start, cPoolOffset)
  }
}

// Sorted char sets of the encodings Buffer#toString produces natively.
const HEX_LOWER_SET = '0123456789abcdef'
const HEX_UPPER_SET = '0123456789ABCDEF'
const BASE64URL_SET = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'
const BASE64_SET = '+/0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

// Native pools hold 65536 chars: the refill is fully native (no JS loop), so a
// bigger pool than CPOOL_TARGET halves refill frequency at no per-char cost.
const NATIVE_POOL_CHARS = 65536

// Tier 1 generator: one native encode per refill. Each hex/base64 output char is
// one uniform, independent group of CSPRNG bits, so for an alphabet with exactly
// that char SET the value-to-char order is irrelevant (same argument as nopeid's
// base64url pool). Raw sizes encode to 65536 chars with whole 3-byte base64
// groups (no padding); hexUpper pays one toUpperCase per refill.
const nativeGenerator = (encoding, upper, defaultSize) => {
  const rawBytes = encoding === 'hex' ? NATIVE_POOL_CHARS >> 1 : (NATIVE_POOL_CHARS >> 2) * 3
  const encode = bytes => {
    const s = bytes.toString(encoding)
    return upper ? s.toUpperCase() : s
  }
  let cPool = '', cPoolOffset = 0, raw
  return (size = defaultSize) => {
    size |= 0
    if (size <= 0) return ''
    // Cold path: chunked native encode, whole groups per slice.
    if (size > NATIVE_POOL_CHARS) {
      const scratch = Buffer.allocUnsafe(rawBytes)
      let out = ''
      while (out.length < size) {
        fillBuffer(scratch)
        out += encode(scratch)
      }
      return out.length > size ? out.slice(0, size) : out
    }
    if (cPoolOffset + size > cPool.length) {
      if (!raw) raw = Buffer.allocUnsafe(rawBytes)
      fillBuffer(raw)
      cPool = encode(raw)
      cPoolOffset = 0
    }
    const start = cPoolOffset
    cPoolOffset += size
    return cPool.substring(start, cPoolOffset)
  }
}

// Custom alphabet factory. Refill tier picked once at factory time: hex/base64
// char sets → native toString; pow-2 length → bulk translate; else 16-bit
// double-digit rejection sampling, or byte-wise cutoff rejection for the lengths
// where that yields more. Hot path: one cPool.substring per call. Also powers
// slugId/shortId.
export const customAlphabet = (alphabet, defaultSize = 21) => {
  const codes = validateAlphabet(alphabet)
  const len = alphabet.length
  const mask = (2 << (31 - Math.clz32((len - 1) | 1))) - 1

  // Tier 1: the char set of hex (either case), base64url or base64, in any order.
  if (len === 16 || len === 64) {
    const set = Array.from(alphabet).sort().join('')
    if (set === HEX_LOWER_SET || set === HEX_UPPER_SET) {
      return nativeGenerator('hex', set === HEX_UPPER_SET, defaultSize)
    }
    if (set === BASE64URL_SET) return nativeGenerator('base64url', false, defaultSize)
    if (set === BASE64_SET) return nativeGenerator('base64', false, defaultSize)
  }

  let cPool = '', cPoolOffset = 0
  let raw // lazily allocated per-factory refill scratch

  // Tier 2: power-of-2 alphabet length. The mask is exact, every byte is
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

  // Tier 3a: non-power-of-2, 16-bit double-digit rejection. Each accepted uint16
  // v < lim (largest multiple of len² ≤ 65536) yields TWO exactly-uniform digits
  // (v % len, (v/len|0) % len): ~2x chars per CSPRNG byte, half the accept-loop
  // iterations vs byte-wise rejection.
  const len2 = len * len
  const lim = 65536 - (65536 % len2)
  // Byte rejection keeps cutoff/256 of the bytes. Where that is >= 95% (numbers,
  // 17, 36, 49 or 62 chars, ...) one compare + lookup per byte beats the u16 pair's
  // divisions, and for len in [182, 255] floor(65536/len²) = 1 makes the pair
  // yield worse: both cases use the byte-wise tier (3b) below.
  const cutoff = 256 - (256 % len)
  if (cutoff < 244 && lim > len * 256) {
    // u16 elements per pass: enough for CPOOL_TARGET/2 accepted pairs with 1.6x
    // headroom, capped at 32768 u16 = 65536 bytes (webcrypto fill quota).
    const passU16 = Math.min(32768, Math.ceil((1.6 * (CPOOL_TARGET >> 1) * 65536) / lim))
    // Scratch arrays own their ArrayBuffers (a u16 view over a pooled Buffer could
    // land on an odd byteOffset and throw). Endianness is irrelevant: both digits
    // come from the SAME u16, so byte order never changes the distribution.
    let scratch16 // lazily allocated alongside `raw`
    return (size = defaultSize) => {
      size |= 0
      if (size <= 0) return ''
      // Cold path for huge requests: local buffers, don't touch the cached cPool.
      if (size > CPOOL_TARGET) {
        const out = Buffer.allocUnsafe(size)
        const local16 = new Uint16Array(passU16)
        let n = 0
        while (n < size) {
          fillBuffer(local16)
          for (let i = 0; i < passU16 && n < size; i++) {
            const v = local16[i]
            if (v < lim) {
              out[n++] = codes[v % len]
              // Odd-size tail: drop d2 (d1 alone is still uniform) instead of
              // relying on a silent out-of-bounds no-op that would desync n.
              if (n < size) out[n++] = codes[((v / len) | 0) % len]
            }
          }
        }
        return out.toString('latin1')
      }
      if (cPoolOffset + size > cPool.length) {
        if (!raw) {
          raw = Buffer.allocUnsafe(passU16 * 2)
          scratch16 = new Uint16Array(passU16)
        }
        const rawCap = passU16 * 2
        let n = 0
        while (n < CPOOL_TARGET) {
          fillBuffer(scratch16)
          // n only moves in steps of 2 and rawCap is even, so n < rawCap
          // guarantees room for the whole pair: a top-up pass after a rare
          // shortfall can never write past `raw`.
          for (let i = 0; i < passU16 && n < rawCap; i++) {
            const v = scratch16[i]
            if (v < lim) {
              raw[n] = codes[v % len]
              raw[n + 1] = codes[((v / len) | 0) % len]
              n += 2
            }
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

  // Tier 3b: byte-wise bulk rejection with the cutoff (byteCodesFor): bulk fill a
  // rejection scratch once, accept in a single pass. A rare statistical
  // shortfall triggers one top-up pass.
  const byteCodes = byteCodesFor(codes, cutoff)
  const passLen = Math.min(65536, Math.ceil((1.6 * 256 * CPOOL_TARGET) / cutoff))
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
          const b = localScratch[i]
          if (b < cutoff) out[n++] = byteCodes[b]
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
          const b = scratch[i]
          if (b < cutoff) raw[n++] = byteCodes[b]
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

// Monotonic state for sortable IDs. lastTime starts as NaN, which equals no
// clock value: a sentinel of 0 would match a mocked Date.now() of 0 (sinon's default)
// and skip the prefix encode, returning 1-char ids (an endless wait in non-secure).
let lastTime = NaN
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
  // Same coercion as nopeid(): without it 2**32+5 would try to build a 4-billion-char
  // tail (hang) and Infinity would leak an internal Buffer RangeError.
  size |= 0
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
      // Carry propagated into the first 11 digits: rebuild their cached string.
      rebuildSortRnd()
    } else {
      // Random overflow - wait for next millisecond with DoS protection
      let iterations = 0
      while (Date.now() === now && iterations++ < MAX_CLOCK_WAIT_ITERATIONS) {
        // Busy wait with iteration limit
      }
      if (iterations >= MAX_CLOCK_WAIT_ITERATIONS) {
        // Clock appears frozen - generate with fresh random anyway (NaN forces the new-ms path)
        lastTime = NaN
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

// Prefixed ID generator. One-entry cache of prefix + separator: callers almost
// always reuse one prefix, so the common call is a single concat onto the head.
let lastPrefix = null
let lastSeparator = null
let lastHead = ''
export const prefixedId = (prefix, size = 21, separator = '_') => {
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

// Validate a string against an alphabet. Non-short-circuit 4-wide table scan
// (avoids the naive first-bad-char timing oracle; NOT strictly constant-time);
// chars > 255 read past the table (undefined) and zero `valid` via `&`.
export const isValid = (id, alphabet = urlAlphabet) => {
  if (typeof id !== 'string' || id.length === 0) return false

  const table = alphabet === urlAlphabet ? URL_VALID_TABLE : validTableFor(alphabet)
  if (table === null) {
    // Rare: the alphabet itself contains non-Latin-1 chars, which the table can't represent.
    const charSet = new Set(alphabet)
    let valid = 1
    for (let i = 0; i < id.length; i++) {
      valid &= charSet.has(id[i]) ? 1 : 0
    }
    return valid === 1
  }
  const n = id.length
  const n4 = n - 3
  let valid = 1
  let i = 0
  for (; i < n4; i += 4) {
    valid &= table[id.charCodeAt(i)] & table[id.charCodeAt(i + 1)] &
      table[id.charCodeAt(i + 2)] & table[id.charCodeAt(i + 3)]
  }
  for (; i < n; i++) valid &= table[id.charCodeAt(i)]
  return valid === 1
}

// Calculate collision probability using birthday paradox
// Uses BigInt for large values to prevent integer overflow
const MAX_SAFE_BIGINT = /* @__PURE__ */ BigInt(Number.MAX_SAFE_INTEGER)
export const collisionProbability = (idLength, alphabetSize = 64) => {
  if (idLength <= 0 || alphabetSize <= 0) {
    throw new Error('Length and alphabet size must be positive')
  }

  // Use BigInt for accurate calculation with large numbers
  const possibleIdsBig = BigInt(alphabetSize) ** BigInt(idLength)
  // Unclamped float drives the statistical metrics (doubles reach ~1.8e308;
  // Infinity for astronomically large spaces yields the correct limits)
  const possibleIdsExact = Number(possibleIdsBig)
  // Clamped Number kept for the reported totalPossible field (backward compatible)
  const possibleIds = possibleIdsBig > MAX_SAFE_BIGINT ? Number.MAX_SAFE_INTEGER : possibleIdsExact

  return {
    totalPossible: possibleIds,
    totalPossibleBigInt: possibleIdsBig,
    // Probability of collision at 1 billion IDs: -Math.expm1(x) = 1 - exp(x)
    // accurately near 0 (the naive form rounds to literal 0 for safe id sizes).
    probabilityForBillion: -Math.expm1((-1e9 * (1e9 - 1)) / (2 * possibleIdsExact)),
    // Safe count before 50% collision probability
    safeCount: Math.sqrt(2 * possibleIdsExact * Math.LN2),
    // Years to generate 1 ID/ms before 1% collision probability
    yearsFor1Percent: Math.sqrt(2 * possibleIdsExact * 0.01) / (365.25 * 24 * 60 * 60 * 1000),
  }
}

// Async version for large batch operations
export const nopeidAsync = async (size = 21) => {
  return nopeid(size)
}

// UUID v4 pool: 1820 pre-formatted slots (own 16 CSPRNG bytes per UUID, v4/variant
// patched, hyphens pre-baked); one 36-char substring per call. 1820 keeps the pool
// string at 65520 chars, under V8's large-string cliff (147KB measurably slower).
const UUID_POOL_COUNT = 1820
const UUID_POOL_BYTES = UUID_POOL_COUNT * 36

// byte → both hex char codes packed for one 16-bit LE store; DataView because
// hyphen offsets leave half the pairs unaligned. Built lazily, shared by the
// uuid() and uuidv7() pool refills.
let HEX16_LE = null
const ensureHex16 = () => {
  if (HEX16_LE === null) {
    HEX16_LE = new Uint16Array(256)
    for (let b = 0; b < 256; b++) HEX16_LE[b] = HEX_HI[b] | (HEX_LO[b] << 8)
  }
  return HEX16_LE
}

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
      ensureHex16()
    }
    fillBuffer(uuidRawScratch)
    const raw = uuidRawScratch
    const dv = uuidPoolView
    const hx = HEX16_LE
    for (let k = 0; k < UUID_POOL_COUNT; k++) {
      const ri = k << 4
      const oo = k * 36
      // Patch v4 version (byte 6) + RFC 4122 variant (byte 8), then write each
      // ADJACENT byte pair's four hex chars with one 32-bit store: 8 runs
      // between the pre-baked hyphens (~1.2x over per-byte 16-bit stores).
      dv.setUint32(oo,      hx[raw[ri]]      | (hx[raw[ri + 1]]  << 16), true)
      dv.setUint32(oo + 4,  hx[raw[ri + 2]]  | (hx[raw[ri + 3]]  << 16), true)
      dv.setUint32(oo + 9,  hx[raw[ri + 4]]  | (hx[raw[ri + 5]]  << 16), true)
      dv.setUint32(oo + 14, hx[(raw[ri + 6] & 0x0f) | 0x40] | (hx[raw[ri + 7]] << 16), true)
      dv.setUint32(oo + 19, hx[(raw[ri + 8] & 0x3f) | 0x80] | (hx[raw[ri + 9]] << 16), true)
      dv.setUint32(oo + 24, hx[raw[ri + 10]] | (hx[raw[ri + 11]] << 16), true)
      dv.setUint32(oo + 28, hx[raw[ri + 12]] | (hx[raw[ri + 13]] << 16), true)
      dv.setUint32(oo + 32, hx[raw[ri + 14]] | (hx[raw[ri + 15]] << 16), true)
    }
    uuidPoolStr = uuidPool.toString('latin1')
    uuidPoolOffset = 0
  }
  const start = uuidPoolOffset
  uuidPoolOffset += 36
  return uuidPoolStr.substring(start, uuidPoolOffset)
}

// Pre-cached generators for common use cases, exported directly: the
// factory-built closure already carries the right default size and honors any
// size argument, so a delegating wrapper would only add a call frame.

// Slug-friendly ID (lowercase + numbers only), default size 12.
export const slugId = customAlphabet(alphabets.lowercase + alphabets.numbers, 12)

// Short ID without similar-looking characters, default size 8.
export const shortId = customAlphabet(alphabets.nolookalikes, 8)

// Crockford char code (either case) -> digit value, -1 if invalid: decodeTime()
// indexes it instead of a per-char toUpperCase() + indexOf() scan.
const CROCKFORD_DIGITS = /* @__PURE__ */ (() => {
  const t = new Int8Array(128).fill(-1)
  for (let i = 0; i < 32; i++) {
    t[CROCKFORD_ALPHABET.charCodeAt(i)] = i
    t[CROCKFORD_ALPHABET.toLowerCase().charCodeAt(i)] = i
  }
  return t
})()

// Decode the timestamp of a sortableId() or ulid() (first 10 Crockford chars)
export const decodeTime = sortableIdStr => {
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

// Upper bound for validated size options (distributedId, defineId), same as
// SECURE_TOKEN_MAX. Without it a size >= 2^31 would pass validation, then wrap
// through nopeid's `size |= 0` into an EMPTY random part: every call would return
// the same bare prefix.
const ID_SIZE_MAX = 65536

// ID with a process-fingerprint prefix. Useful for tracing ID origin in
// multi-process / multi-node systems. Collision resistance comes from the
// random tail, so sizes that leave too little of it are rejected.
let distributedHead = null // getFingerprint() + '_', built once on first use
export const distributedId = (size = 25) => {
  if (!Number.isInteger(size) || size < DISTRIBUTED_ID_MIN || size > ID_SIZE_MAX) {
    throw new Error(`distributedId size must be an integer between ${DISTRIBUTED_ID_MIN} and ${ID_SIZE_MAX}`)
  }
  if (distributedHead === null) distributedHead = getFingerprint() + '_'
  return distributedHead + nopeid(size - distributedHead.length)
}

// === UUID v7 (RFC 9562) - time-ordered, index-friendly ===

// Pre-formatted v7 tail pool: 2048 × 21 chars ("xxx-yxxx-xxxxxxxxxxxx", hyphens +
// '89ab' variant baked in), one 43008-char string per refill; 10 CSPRNG bytes =
// 74 random bits per entry (RFC 9562). A call = cached ms prefix + ONE substring.
const V7_TAIL_COUNT = 2048
const V7_TAIL_LEN = 21
const V7_POOL_CHARS = V7_TAIL_COUNT * V7_TAIL_LEN // 43008
// Variant from 2 raw CSPRNG bits: uniform over '89ab' char codes.
const V7_VARIANT_CODES = /* @__PURE__ */ Uint8Array.from('89ab', c => c.charCodeAt(0))

let v7Pool, v7PoolView, v7Raw, v7PoolStr = ''
let v7PoolOffset = V7_POOL_CHARS // force a refill on the first call

const fillV7Pool = () => {
  if (!v7Pool) {
    v7Pool = Buffer.allocUnsafe(V7_POOL_CHARS)
    v7PoolView = new DataView(v7Pool.buffer, v7Pool.byteOffset, V7_POOL_CHARS)
    v7Raw = Buffer.allocUnsafe(V7_TAIL_COUNT * 10)
    // Hyphens are baked once at allocation; refills never write o+3 / o+8.
    for (let k = 0; k < V7_TAIL_COUNT; k++) {
      const o = k * V7_TAIL_LEN
      v7Pool[o + 3] = 0x2d
      v7Pool[o + 8] = 0x2d
    }
    ensureHex16()
  }
  fillBuffer(v7Raw)
  const dv = v7PoolView
  const hx = HEX16_LE
  const raw = v7Raw
  const pool = v7Pool
  for (let k = 0; k < V7_TAIL_COUNT; k++) {
    const ri = k * 10
    const o = k * V7_TAIL_LEN
    // rand_a: b0 + b1's high nibble (chars 0-2); variant: b1's low 2 bits;
    // rand_b: b2 + b3's high nibble (chars 5-7) + b4..b9 (chars 9-20); b3's low
    // nibble discarded. Two folded 32-bit stores cover 0-2+'-' and variant+5-7.
    dv.setUint32(o, hx[raw[ri]] | (HEX_HI[raw[ri + 1]] << 16) | (0x2d << 24), true)
    dv.setUint32(o + 4,
      V7_VARIANT_CODES[raw[ri + 1] & 3] | (hx[raw[ri + 2]] << 8) | (HEX_HI[raw[ri + 3]] << 24), true)
    dv.setUint16(o + 9, hx[raw[ri + 4]], true)
    dv.setUint16(o + 11, hx[raw[ri + 5]], true)
    dv.setUint16(o + 13, hx[raw[ri + 6]], true)
    dv.setUint16(o + 15, hx[raw[ri + 7]], true)
    dv.setUint16(o + 17, hx[raw[ri + 8]], true)
    dv.setUint16(o + 19, hx[raw[ri + 9]], true)
  }
  v7PoolStr = pool.toString('latin1')
  v7PoolOffset = 0
}

// UUID v7: 48-bit ms timestamp + version + variant + 74 random bits. The
// 15-char "tttttttt-tttt-7" prefix is cached per ms; the pre-formatted pool
// supplies the remaining 21 chars in one substring.
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
  if (v7PoolOffset >= V7_POOL_CHARS) fillV7Pool()
  const start = v7PoolOffset
  v7PoolOffset += V7_TAIL_LEN
  return v7Prefix + v7PoolStr.substring(start, v7PoolOffset)
}

// === ULID (spec-compliant, 26 chars: 10 timestamp + 16 random, Crockford Base32) ===

// Module-level scratch buffer for encoding the 10-char ULID timestamp prefix.
const ULID_BUF = /* @__PURE__ */ Buffer.allocUnsafe(10)

// Pooled Crockford string for ulid()'s 16 random chars: each 32-bit word repacks
// into SIX bias-free 5-bit digits (top 2 bits discarded): 1/4 the iterations and
// 2/3 the CSPRNG bytes of a byte-per-digit loop; 49152-char pool; scratch owns its
// buffer (aligned u32).
let crockPoolStr = '', crockPoolOffset = 0, crockScratch32, crockPoolOut
const crockTail = n => {
  if (crockPoolOffset + n > crockPoolStr.length) {
    if (!crockScratch32) {
      crockScratch32 = new Uint32Array(8192) // 32768 CSPRNG bytes per refill
      crockPoolOut = Buffer.allocUnsafe(49152)
    }
    fillBuffer(crockScratch32)
    const src = crockScratch32
    const out = crockPoolOut
    const codes = CROCKFORD_CODES
    let p = 0
    for (let i = 0; i < 8192; i++) {
      const v = src[i]
      out[p] = codes[v & 31]
      out[p + 1] = codes[(v >>> 5) & 31]
      out[p + 2] = codes[(v >>> 10) & 31]
      out[p + 3] = codes[(v >>> 15) & 31]
      out[p + 4] = codes[(v >>> 20) & 31]
      out[p + 5] = codes[(v >>> 25) & 31]
      p += 6
    }
    crockPoolStr = out.toString('latin1')
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

// Monotonic ULID factory with ISOLATED state (never touches global sortableId
// state). Same/backwards-ms calls bump the random part as a base-32 counter; hot
// path = cached 25-char head + one tail char code, head rebuilt only on carry/new ms.
export const monotonicFactory = () => {
  let lastTime = NaN // NaN sentinel: <= matches no seed, so the first call always encodes
  let lastRand = []
  const out = Buffer.allocUnsafe(25) // scratch for the head; the tail char is tracked separately
  let head25 = ''
  let tailCode = 0
  return (seedTime = Date.now()) => {
    if (seedTime <= lastTime) {
      if (lastRand[15] < 31) {
        // Common case: only the last counter digit advances, so head25 stays valid.
        tailCode = CROCKFORD_CODES[++lastRand[15]]
        return head25 + String.fromCharCode(tailCode)
      }
      // Tail saturated: propagate the carry into the head digits, then rebuild.
      lastRand[15] = 0
      tailCode = CROCKFORD_CODES[0]
      for (let i = 14; i >= 0; i--) {
        if (lastRand[i] < 31) {
          lastRand[i]++
          out[10 + i] = CROCKFORD_CODES[lastRand[i]]
          break
        }
        lastRand[i] = 0
        out[10 + i] = CROCKFORD_CODES[0]
      }
      head25 = out.toString('latin1', 0, 25)
    } else if (isUlidTime(seedTime)) {
      // Manual loop instead of Array.from(arr, fn) so we don't rely on V8 hoisting.
      lastTime = seedTime
      const bytes = randomView(16)
      lastRand = new Array(16)
      let ms = seedTime
      for (let i = 9; i >= 0; i--) { out[i] = CROCKFORD_CODES[ms % 32]; ms = Math.floor(ms / 32) }
      for (let i = 0; i < 15; i++) {
        lastRand[i] = bytes[i] & 31
        out[10 + i] = CROCKFORD_CODES[lastRand[i]]
      }
      lastRand[15] = bytes[15] & 31
      tailCode = CROCKFORD_CODES[lastRand[15]]
      head25 = out.toString('latin1', 0, 25)
    } else {
      throw new Error(ULID_TIME_ERROR)
    }
    return head25 + String.fromCharCode(tailCode)
  }
}

// === Snowflake (distributed 64-bit ID, returned as a string) ===

const DEFAULT_SNOWFLAKE_EPOCH = 1288834974657n // Twitter epoch (2010-11-04)

// Decimal string of t * 2^22 + low (low < 2^22) in exact double arithmetic, no
// BigInt: t splits at 10^6 so every partial product stays below 2^53. Same digits
// as the BigInt layout for 0 <= t < ~2.1e15 ms (tens of millennia past any epoch).
const snowflakeDecimal = (t, low) => {
  const tHi = Math.floor(t / 1e6) // floor division: a double % is a slow fmod call
  const lo = (t - tHi * 1e6) * 4194304 + low
  const carry = Math.floor(lo / 1e6)
  const head = tHi * 4194304 + carry
  const tail = lo - carry * 1e6
  return head > 0 ? head + String(tail + 1e6).slice(1) : String(tail)
}

// Factory: each instance owns its sequence/timestamp state (coordination-free per node).
// Layout: 41-bit timestamp | 10-bit nodeId | 12-bit sequence.
export const snowflakeFactory = (options = {}) => {
  const rawNodeId = options.nodeId == null ? 0 : options.nodeId
  if (!Number.isInteger(rawNodeId) || rawNodeId < 0 || rawNodeId > 1023) {
    throw new Error('snowflakeFactory nodeId must be an integer between 0 and 1023')
  }
  const nodeBits = rawNodeId * 4096 // nodeId << 12
  let epoch = DEFAULT_SNOWFLAKE_EPOCH
  if (options.epoch != null) {
    try { epoch = BigInt(options.epoch) } catch { throw new Error('Invalid snowflake epoch') }
  }
  // A non-negative safe integer (a real date) keeps every id below 2^53 * 2^22, where
  // snowflakeDecimal is exact; absurd epochs (negative, beyond 2^53) are rejected.
  const epochMs = Number(epoch)
  if (!Number.isSafeInteger(epochMs) || epochMs < 0) throw new Error('Invalid snowflake epoch')
  let lastTs = -1
  let sequence = 0
  return () => {
    let ts = Date.now()
    if (ts <= lastTs) {
      // Same ms (or clock moved back): bump sequence; roll to next ms on overflow
      sequence = (sequence + 1) & 0xfff
      if (sequence === 0) {
        do { ts = Date.now() } while (ts <= lastTs)
      } else {
        ts = lastTs
      }
    } else {
      sequence = 0
    }
    lastTs = ts
    const t = ts - epochMs
    // A clock before the epoch would yield a negative id that decodeSnowflake rejects.
    if (t < 0) throw new Error('Snowflake clock is before the epoch')
    return snowflakeDecimal(t, nodeBits + sequence)
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

// ObjectId: the 22-hex ts+machine+counter-head cache changes only on a new
// second or a counter low-byte rollover (every 256 calls); each call appends
// just the counter's low hex pair: a two-piece concat.
let oidCounter = 0     // 3-byte incrementing counter (lazy random start)
let oidLastSec = -1    // second the cached prefix was built for
let oidPrefix = null   // 18 hex chars: 8 timestamp + 10 machine (null = lazy init pending)
let oidMachineHex = ''
let oidHead = ''       // 22 hex chars: prefix + counter's high 4 hex digits
let oidLastHi = -1     // oidCounter >>> 8 the cached head was built for
export const objectId = () => {
  if (oidPrefix === null) {
    const m = randomView(5)
    oidMachineHex = byteToHex[m[0]] + byteToHex[m[1]] + byteToHex[m[2]] +
      byteToHex[m[3]] + byteToHex[m[4]]
    const c = randomView(3)
    oidCounter = (c[0] << 16) | (c[1] << 8) | c[2]
  }
  const sec = Math.floor(Date.now() / 1000) // not |0: stays valid past 2038
  oidCounter = (oidCounter + 1) & 0xffffff
  const hi = oidCounter >>> 8 // increment FIRST so the head matches this call's counter
  if (sec !== oidLastSec || hi !== oidLastHi) {
    if (sec !== oidLastSec) {
      oidLastSec = sec
      oidPrefix = byteToHex[(sec >>> 24) & 0xff] + byteToHex[(sec >>> 16) & 0xff] +
        byteToHex[(sec >>> 8) & 0xff] + byteToHex[sec & 0xff] + oidMachineHex
    }
    oidLastHi = hi
    oidHead = oidPrefix + byteToHex[(hi >>> 8) & 0xff] + byteToHex[hi & 0xff]
  }
  return oidHead + byteToHex[oidCounter & 0xff]
}

// Hex char code (either case) -> nibble value, -1 if not hex.
const HEX_NIBBLE = /* @__PURE__ */ (() => {
  const t = new Int8Array(128).fill(-1)
  for (let i = 0; i < 16; i++) {
    t['0123456789abcdef'.charCodeAt(i)] = i
    t['0123456789ABCDEF'.charCodeAt(i)] = i
  }
  return t
})()

// Extract the creation Date from an ObjectId (first 4 bytes = seconds). One pass
// validates all 24 hex chars (a length-only check would let 'z'.repeat(24) silently
// return Invalid Date) and accumulates the 8-char timestamp.
export const decodeObjectIdTime = id => {
  if (typeof id !== 'string' || id.length !== 24) throw new Error('Invalid ObjectId')
  let seconds = 0
  for (let i = 0; i < 24; i++) {
    const code = id.charCodeAt(i)
    const nibble = code < 128 ? HEX_NIBBLE[code] : -1
    if (nibble < 0) throw new Error('Invalid ObjectId')
    if (i < 8) seconds = seconds * 16 + nibble
  }
  return new Date(seconds * 1000)
}

// === Sqids (reversible integer <-> short string encoding; obfuscation, NOT encryption) ===

const DEFAULT_SQIDS_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
// Work-alphabet rounds cached per offset (see workFor): covers ids of up to 8
// numbers with no shuffling; bounds the cache at alphabet.length * 8 small arrays.
const SQIDS_CACHED_ROUNDS = 8

export const sqidsFactory = (options = {}) => {
  // `!= null` (not ||): an explicit '' alphabet or NaN minLength must fail
  // validation instead of silently falling back to the defaults.
  const baseAlphabet = options.alphabet != null ? options.alphabet : DEFAULT_SQIDS_ALPHABET
  const minLength = options.minLength != null ? options.minLength : 0
  const blocklist = (options.blocklist || []).map(w => w.toLowerCase())

  if (typeof baseAlphabet !== 'string') throw new Error('Sqids alphabet must be a string')
  if (baseAlphabet.length < 3) throw new Error('Sqids alphabet must be at least 3 characters')
  if (new Set(baseAlphabet).size !== baseAlphabet.length) {
    throw new Error('Sqids alphabet must contain unique characters')
  }
  // Same 0..255 range as the Sqids reference implementation (a huge minLength
  // would pad each id until the array allocation fails).
  if (!Number.isInteger(minLength) || minLength < 0 || minLength > 255) {
    throw new Error('Sqids minLength must be an integer between 0 and 255')
  }

  // The codec works on arrays of UTF-16 code units, not per-char strings: the
  // reference's split('')/join/unshift churn becomes in-place array ops + one
  // fromCharCode at the end. Code units match split('') semantics exactly
  // (astral chars behave identically, as two independent units).
  const alphaLen = baseAlphabet.length

  // Deterministic shuffle (no PRNG; derived from the alphabet itself),
  // in place on a working copy.
  const shuffleCodes = codes => {
    for (let i = 0, j = codes.length - 1; j > 0; i++, j--) {
      const r = (i * j + codes[i] + codes[j]) % codes.length
      const t = codes[i]; codes[i] = codes[r]; codes[r] = t
    }
    return codes
  }
  // Built per code UNIT (charCodeAt over 0..length-1), NOT via string
  // iteration: Array.from(string) walks code points and would desync astral
  // alphabets from the reference's split('') behavior.
  const alphaCodes = new Array(alphaLen)
  for (let i = 0; i < alphaLen; i++) alphaCodes[i] = baseAlphabet.charCodeAt(i)
  shuffleCodes(alphaCodes)

  const codesToString = codes => {
    if (codes.length <= 4096) return String.fromCharCode.apply(null, codes)
    let s = ''
    for (let i = 0; i < codes.length; i += 4096) {
      s += String.fromCharCode.apply(null, codes.slice(i, i + 4096))
    }
    return s
  }

  // Append num in base (work.length - 1) using work[1..] as digits: the
  // reference's toId(num, alpha.slice(1)) without the slice/unshift/join.
  const appendToId = (out, num, work) => {
    const base = work.length - 1
    const startLen = out.length
    let n = num
    do {
      out.push(work[1 + (n % base)])
      n = Math.floor(n / base)
    } while (n > 0)
    for (let a = startLen, b = out.length - 1; a < b; a++, b--) {
      const t = out[a]; out[a] = out[b]; out[b] = t
    }
  }

  // Per word, precomputed: does it contain a digit (prefix/suffix-only rule)?
  const blockHasDigit = blocklist.map(word => /\d/.test(word))
  const isBlocked = id => {
    const lower = id.toLowerCase()
    for (let k = 0; k < blocklist.length; k++) {
      const word = blocklist[k]
      if (word.length > lower.length) continue
      if (lower.length <= 3 || word.length <= 3) {
        if (lower === word) return true
      } else if (blockHasDigit[k]) {
        if (lower.startsWith(word) || lower.endsWith(word)) return true
      } else if (lower.includes(word)) {
        return true
      }
    }
    return false
  }

  // The work alphabet is a pure function of (offset, round): round 0 is
  // reverse(rotate(alphabet, offset)), i.e. a window of the doubled reversed
  // alphabet, and each later round shuffles the previous one. The first
  // SQIDS_CACHED_ROUNDS rounds are cached per offset (read-only, built on first
  // use; deeper rounds, i.e. very long number lists, are computed on the fly),
  // so a typical encode/decode does no rotation and no shuffle at all.
  const reversed = Uint16Array.from(alphaCodes).reverse()
  const reversedTwice = new Uint16Array(2 * alphaLen)
  reversedTwice.set(reversed)
  reversedTwice.set(reversed, alphaLen)
  const roundCache = new Array(alphaLen) // offset -> [round 0, round 1, ...]
  const workFor = (offset, round, prev) => {
    let rounds = roundCache[offset]
    if (rounds === undefined) {
      rounds = roundCache[offset] = [reversedTwice.slice(alphaLen - offset, 2 * alphaLen - offset)]
    }
    if (round < rounds.length) return rounds[round]
    // Rounds are requested in order, so here round === rounds.length (or the cache is full)
    const work = shuffleCodes(prev.slice())
    if (round < SQIDS_CACHED_ROUNDS) rounds.push(work)
    return work
  }

  const encodeNumbers = (numbers, increment = 0) => {
    if (increment > alphaLen) throw new Error('Reached max attempts to re-generate the ID')
    let offset = numbers.length
    for (let i = 0; i < numbers.length; i++) {
      offset += alphaCodes[numbers[i] % alphaLen] + i
    }
    offset %= alphaLen
    offset = (offset + increment) % alphaLen
    // The prefix is the head of rotate(alphabet, offset).
    const out = [alphaCodes[offset]]
    let work = workFor(offset, 0)
    for (let i = 0; i < numbers.length; i++) {
      appendToId(out, numbers[i], work)
      if (i < numbers.length - 1) {
        out.push(work[0])
        work = workFor(offset, i + 1, work)
      }
    }
    if (minLength > out.length) {
      out.push(work[0])
      for (let round = numbers.length; minLength - out.length > 0; round++) {
        work = workFor(offset, round, work)
        const take = Math.min(minLength - out.length, alphaLen)
        for (let i = 0; i < take; i++) out.push(work[i])
      }
    }
    let id = codesToString(out)
    if (blocklist.length > 0 && isBlocked(id)) id = encodeNumbers(numbers, increment + 1)
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

  // Reference decode semantics, cheaper: split(separator)/rejoin per round is
  // just "up to the first separator occurrence", so scan with indexOf instead.
  const alphabetStr = codesToString(alphaCodes)
  const decode = id => {
    const ret = []
    if (!id) return ret
    for (const c of id) if (!alphabetStr.includes(c)) return ret
    const offset = alphabetStr.indexOf(id[0])
    let work = workFor(offset, 0)
    let round = 0
    let slug = id.slice(1)
    while (slug.length > 0) {
      const separator = String.fromCharCode(work[0])
      const sepIdx = slug.indexOf(separator)
      if (sepIdx === 0) return ret // reference: chunks[0] === ''
      const chunk = sepIdx === -1 ? slug : slug.slice(0, sepIdx)
      // toNumber over work[1..]: indexOf(-1) folds in exactly like the
      // reference's chars.indexOf(c) for anything not in the digit set.
      const base = alphaLen - 1
      let n = 0
      for (const c of chunk) {
        const pos = c.length === 1 ? work.indexOf(c.charCodeAt(0), 1) : -1
        n = n * base + (pos === -1 ? -1 : pos - 1)
      }
      ret.push(n)
      if (sepIdx === -1) break
      work = workFor(offset, ++round, work)
      slug = slug.slice(sepIdx + 1)
    }
    return ret
  }

  return { encode, decode }
}

// === Typed prefixed IDs (Stripe-style: generator + type guard + parser) ===

// Shared is()-style guard for defineId()/defineToken(): exact head + exact body
// length + alphabet membership (a bare 'usr_a' must not pass). The body is checked
// in place with isValid()'s 4-wide non-short-circuit table scan (no slice, no table
// lookup per call); alphabets reaching here were already validated as Latin-1.
const makePrefixedCheck = (head, size, alphabet) => {
  const table = alphabet === urlAlphabet ? URL_VALID_TABLE : validTableFor(alphabet)
  const total = head.length + size
  return value => {
    if (typeof value !== 'string' || value.length !== total || !value.startsWith(head)) return false
    const end4 = total - 3
    let valid = 1
    let i = head.length
    for (; i < end4; i += 4) {
      valid &= table[value.charCodeAt(i)] & table[value.charCodeAt(i + 1)] &
        table[value.charCodeAt(i + 2)] & table[value.charCodeAt(i + 3)]
    }
    for (; i < total; i++) valid &= table[value.charCodeAt(i)]
    return valid === 1
  }
}

export const defineId = (prefix, opts = {}) => {
  if (typeof prefix !== 'string') throw new Error('Prefix must be a string')
  const size = opts.size != null ? opts.size : 21
  if (!Number.isInteger(size) || size <= 0 || size > ID_SIZE_MAX) {
    throw new Error(`Size must be an integer between 1 and ${ID_SIZE_MAX}`)
  }
  const separator = opts.separator != null ? opts.separator : '_'
  // `!= null` like size/separator: an explicit '' must reach customAlphabet's
  // validation (and throw) instead of silently becoming urlAlphabet.
  const alphabet = opts.alphabet != null ? opts.alphabet : urlAlphabet
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
// bytes; no future-token cache to leak (unlike pooled nopeid()).

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
  // Local buffer: bypasses both the shared `pool` and the cached `idPoolStr`.
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
 * Same shape as defineId(), but the body is produced by secureToken() (no shared
 * pool or cache) and the alphabet is fixed to URL-safe 64-char for stability.
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

// === orderedId(): sortable 21-char Base58 ID, hot-path string cache ===
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

// Cached hot-path state. timestampCacheMs starts at -Infinity so the first call
// always takes the full encode path, whatever the clock says (a sentinel of 0 would
// let a mocked Date.now() of 0 take the same-ms path and emit 9-char ids).
let timestampCacheMs = -Infinity
let timestampCachePrefix = ''        // 8-char Base58 ts (live)
let prefixPlusCounterHead = ''       // 12-char string: ts + 4 counter head chars
let counterTailCharCode = FIRST_CHAR_CODE

// Random pool: Base58 codes via the same 16-bit double-digit sampling as tier 3a
// (uint16 v < B58_LIM yields two uniform digits); one string per refill, hot path
// serves 8 chars via substring (same trick as nopeid()'s idPoolStr).
const ORDERED_RND_POOL_SIZE = 16384
const B58_LIM = 63916 // 58² × 19
const BASE58_CODES = /* @__PURE__ */ Uint8Array.from(BASE58_ALPHABET, c => c.charCodeAt(0))

let orderedRndScratch16
let orderedRndCharCodes
let orderedRndPoolStr = ''
let orderedRndCount = 0
let orderedRndPosition = 0

const refillRandom = () => {
  if (!orderedRndScratch16) {
    // Owns its ArrayBuffer (offset 0) so the u16 view is always aligned.
    orderedRndScratch16 = new Uint16Array(ORDERED_RND_POOL_SIZE >> 1)
    orderedRndCharCodes = Buffer.allocUnsafe(ORDERED_RND_POOL_SIZE)
  }
  fillBuffer(orderedRndScratch16)
  const src = orderedRndScratch16
  const out = orderedRndCharCodes
  const codes = BASE58_CODES
  let count = 0
  // count moves in steps of 2 and caps at 8192 pairs = the out capacity, so
  // the pair write can never overrun.
  for (let i = 0; i < 8192; i++) {
    const v = src[i]
    if (v < B58_LIM) {
      out[count] = codes[v % 58]
      out[count + 1] = codes[((v / 58) | 0) % 58]
      count += 2
    }
  }
  orderedRndCount = count
  // One Buffer.toString per refill; orderedRndCharCodes stays available as
  // a byte view for seedCounter(), which needs raw char codes.
  orderedRndPoolStr = out.toString('latin1', 0, count)
  orderedRndPosition = 0
}

// Encode a fresh 8-char Base58 ts prefix string. Unrolled to avoid a loop.
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
// entire number; most clock advances are 1-3 ms.
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
    // Same ms: advance the counter tail in O(1).
    const nxt = SUCCESSOR_CC[counterTailCharCode]
    if (nxt) counterTailCharCode = nxt
    else incrementCounterHead()
  }
  // 3-operand concat: cached 12-char prefix + 1-char tail + 8-char copied
  // substring; measured fastest on Node 22 against fromCharCode and four other variants.
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
 * clamped (it never emits a smaller ts prefix) and same-ms counter overflow
 * does a synthetic +1 ms bump: no busy-wait, no recursion.
 */
export const orderedId = () => nextOrderedIdWithMs(Date.now())

/**
 * 21-byte ASCII form of a fresh orderedId(): Base58 char codes in latin1,
 * NOT packed binary.
 */
orderedId.asciiBytes = () => Buffer.from(orderedId(), 'latin1')

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
    // mirrors nextOrderedIdWithMs()'s else-branch + build; keep the two in sync.
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
