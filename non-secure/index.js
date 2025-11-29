// nope-id - Non-secure version (uses Math.random)
// WARNING: Do not use for security-sensitive purposes!
// Suitable for UI element IDs, temporary keys, etc.

// URL-safe alphabet
export const urlAlphabet =
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

// Pre-built alphabets
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

// Custom alphabet ID generator
export const customAlphabet = (alphabet, defaultSize = 21) => {
  if (!alphabet || alphabet.length === 0) {
    throw new Error('Alphabet cannot be empty')
  }

  return (size = defaultSize) => {
    if (size <= 0) return ''
    let id = ''
    let i = size
    while (i--) {
      id += alphabet[(Math.random() * alphabet.length) | 0]
    }
    return id
  }
}

// Main nopeid function (non-secure)
export const nopeid = (size = 21) => {
  if (size <= 0) return ''
  let id = ''
  let i = size
  while (i--) {
    id += urlAlphabet[(Math.random() * 64) | 0]
  }
  return id
}

// === FEATURES ===

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

// Sortable ID with monotonic guarantee
export const sortableId = (size = 22) => {
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
    return size === 22 ? fullId : fullId + nopeid(size - 22)
  }
  return fullId.slice(0, size)
}

// Prefixed ID
export const prefixedId = (prefix, size = 21, separator = '_') => {
  if (typeof prefix !== 'string') {
    throw new Error('Prefix must be a string')
  }
  return `${prefix}${separator}${nopeid(size)}`
}

// Generate multiple IDs
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

export default nopeid
