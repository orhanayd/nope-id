// nope-id - CommonJS version
// Secure, fast, and collision-resistant unique ID generator

'use strict'

const { randomBytes, randomFillSync } = require('crypto')

// URL-safe alphabet (optimized for compression)
const urlAlphabet =
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

// Pre-built alphabets for different use cases
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

// Pool management
const POOL_SIZE_MULTIPLIER = 128
let pool, poolOffset

const fillPool = bytes => {
  if (!pool || pool.length < bytes) {
    pool = Buffer.allocUnsafe(bytes * POOL_SIZE_MULTIPLIER)
    randomFillSync(pool)
    poolOffset = 0
  } else if (poolOffset + bytes > pool.length) {
    randomFillSync(pool)
    poolOffset = 0
  }
  poolOffset += bytes
}

const random = bytes => {
  if (bytes <= 0) return Buffer.alloc(0)
  fillPool((bytes |= 0))
  return pool.subarray(poolOffset - bytes, poolOffset)
}

const getMask = alphabetLength => {
  return (2 << (31 - Math.clz32((alphabetLength - 1) | 1))) - 1
}

const getStep = (mask, size, alphabetLength) => {
  return Math.ceil((1.6 * mask * size) / alphabetLength)
}

const customAlphabet = (alphabet, defaultSize = 21) => {
  if (!alphabet || alphabet.length === 0) {
    throw new Error('Alphabet cannot be empty')
  }
  if (alphabet.length > 256) {
    throw new Error('Alphabet cannot be longer than 256 characters')
  }

  const mask = getMask(alphabet.length)

  return (size = defaultSize) => {
    if (size <= 0) return ''
    size |= 0

    const step = getStep(mask, size, alphabet.length)
    let id = ''

    while (true) {
      const bytes = random(step)
      let i = step
      while (i--) {
        const byte = bytes[i] & mask
        if (byte < alphabet.length) {
          id += alphabet[byte]
          if (id.length === size) return id
        }
      }
    }
  }
}

const customRandom = (alphabet, defaultSize, getRandom) => {
  if (!alphabet || alphabet.length === 0) {
    throw new Error('Alphabet cannot be empty')
  }

  const mask = getMask(alphabet.length)

  return (size = defaultSize) => {
    if (size <= 0) return ''
    size |= 0

    const step = getStep(mask, size, alphabet.length)
    let id = ''

    while (true) {
      const bytes = getRandom(step)
      let i = step
      while (i--) {
        const byte = bytes[i] & mask
        if (byte < alphabet.length) {
          id += alphabet[byte]
          if (id.length === size) return id
        }
      }
    }
  }
}

const nopeid = (size = 21) => {
  if (size <= 0) return ''
  fillPool((size |= 0))

  let id = ''
  for (let i = poolOffset - size; i < poolOffset; i++) {
    id += urlAlphabet[pool[i] & 63]
  }
  return id
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

const sortableId = (size = 22) => {
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

const isValid = (id, alphabet = urlAlphabet) => {
  if (typeof id !== 'string' || id.length === 0) return false

  const charSet = new Set(alphabet)
  for (let i = 0; i < id.length; i++) {
    if (!charSet.has(id[i])) return false
  }
  return true
}

const collisionProbability = (idLength, alphabetSize = 64) => {
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

const nopeidAsync = async (size = 21) => {
  if (size <= 0) return ''

  return new Promise((resolve, reject) => {
    randomBytes(size, (err, bytes) => {
      if (err) return reject(err)
      let id = ''
      for (let i = 0; i < size; i++) {
        id += urlAlphabet[bytes[i] & 63]
      }
      resolve(id)
    })
  })
}

const uuid = () => {
  const bytes = random(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

// Pre-cached generators
const slugGenerator = customAlphabet(alphabets.lowercase + alphabets.numbers, 12)
const shortGenerator = customAlphabet(alphabets.nolookalikes, 8)

const slugId = (size = 12) => {
  if (size === 12) return slugGenerator()
  return customAlphabet(alphabets.lowercase + alphabets.numbers, size)()
}

const shortId = (size = 8) => {
  if (size === 8) return shortGenerator()
  return customAlphabet(alphabets.nolookalikes, size)()
}

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
  const fp = getFingerprint()
  const remaining = size - fp.length - 1
  return `${fp}_${remaining > 0 ? nopeid(remaining) : ''}`
}

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
