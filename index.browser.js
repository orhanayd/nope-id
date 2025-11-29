// nope-id - Browser version (Web Crypto API)
// Secure, fast, and collision-resistant unique ID generator

// URL-safe alphabet (optimized for compression)
export const urlAlphabet =
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

// Pre-computed lookup table for O(1) alphabet access
const urlAlphabetLookup = /* @__PURE__ */ urlAlphabet.split('')

// Pre-built alphabets for different use cases
export const alphabets = {
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

// Get random bytes from pool
export const random = bytes => {
  fillPool((bytes |= 0))
  return pool.subarray(poolOffset - bytes, poolOffset)
}

// Custom random function ID generator (core implementation)
export const customRandom = (alphabet, defaultSize, getRandom) => {
  if (!alphabet || alphabet.length === 0) {
    throw new Error('Alphabet cannot be empty')
  }
  // Pre-compute constants and lookup table
  const alphabetLookup = alphabet.split('')
  const len = alphabet.length
  const mask = (2 << (31 - Math.clz32((len - 1) | 1))) - 1
  const step = Math.ceil((1.6 * mask * defaultSize) / len)

  return (size = defaultSize) => {
    if (size <= 0) return ''
    let id = ''
    while (true) {
      const bytes = getRandom(step)
      let i = step
      while (i--) {
        id += alphabetLookup[bytes[i] & mask] || ''
        if (id.length >= size) return id
      }
    }
  }
}

// Custom alphabet ID generator factory
export const customAlphabet = (alphabet, defaultSize = 21) => {
  if (!alphabet || alphabet.length === 0) {
    throw new Error('Alphabet cannot be empty')
  }
  if (alphabet.length > 256) {
    throw new Error('Alphabet cannot be longer than 256 characters')
  }
  return customRandom(alphabet, defaultSize, random)
}

// Main nopeid function - 21 characters by default
export const nopeid = (size = 21) => {
  // Inline pool management for hot path performance
  size |= 0
  if (size <= 0) return ''
  if (pool.length < size) {
    const poolSize = Math.min(size * POOL_SIZE_MULTIPLIER, MAX_POOL_SIZE)
    pool = new Uint8Array(Math.max(poolSize, size))
    fillBuffer(pool)
    poolOffset = 0
  } else if (poolOffset + size > pool.length) {
    fillBuffer(pool)
    poolOffset = 0
  }

  let id = ''
  const end = poolOffset + size
  while (poolOffset < end) {
    id += urlAlphabetLookup[pool[poolOffset++] & 63]
  }
  return id
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

// ULID-like sortable ID with monotonic guarantee
export const sortableId = (size = 22) => {
  if (size <= 0) return ''
  const now = Date.now()

  if (now === lastTime) {
    if (!incrementRandom()) {
      while (Date.now() === now) {
        // Busy wait
      }
      return sortableId(size)
    }
  } else {
    lastTime = now
    const bytes = random(RANDOM_LENGTH)
    lastRandom = Array.from(bytes, b => b & 31)
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
    return size === 22 ? fullId : fullId + nopeid(size - 22)
  }
  return fullId.slice(0, size)
}

// Prefixed ID generator
export const prefixedId = (prefix, size = 21, separator = '_') => {
  if (typeof prefix !== 'string') {
    throw new Error('Prefix must be a string')
  }
  return `${prefix}${separator}${nopeid(size)}`
}

// Generate multiple unique IDs
export const generateMany = (count, size = 21) => {
  if (count <= 0) return []
  count |= 0

  const ids = new Array(count)
  for (let i = 0; i < count; i++) {
    ids[i] = nopeid(size)
  }
  return ids
}

// Validate ID
export const isValid = (id, alphabet = urlAlphabet) => {
  if (typeof id !== 'string' || id.length === 0) return false

  const charSet = new Set(alphabet)
  for (let i = 0; i < id.length; i++) {
    if (!charSet.has(id[i])) return false
  }
  return true
}

// Calculate collision probability
export const collisionProbability = (idLength, alphabetSize = 64) => {
  if (idLength <= 0 || alphabetSize <= 0) {
    throw new Error('Length and alphabet size must be positive')
  }

  const possibleIds = alphabetSize ** idLength
  return {
    totalPossible: possibleIds,
    probabilityForBillion: 1 - Math.exp((-1e9 * (1e9 - 1)) / (2 * possibleIds)),
    safeCount: Math.sqrt(2 * possibleIds * Math.log(2)),
    yearsFor1Percent: Math.sqrt(2 * possibleIds * 0.01) / (365.25 * 24 * 60 * 60 * 1000),
  }
}

// Async version
export const nopeidAsync = async (size = 21) => {
  return nopeid(size)
}

// UUID v4
export const uuid = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

// Pre-cached generators
const slugGenerator = customAlphabet(alphabets.lowercase + alphabets.numbers, 12)
const shortGenerator = customAlphabet(alphabets.nolookalikes, 8)

// Slug ID
export const slugId = (size = 12) => {
  if (size === 12) return slugGenerator()
  return customAlphabet(alphabets.lowercase + alphabets.numbers, size)()
}

// Short ID
export const shortId = (size = 8) => {
  if (size === 8) return shortGenerator()
  return customAlphabet(alphabets.nolookalikes, size)()
}

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
export const distributedId = (size = 25) => {
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

export default nopeid
