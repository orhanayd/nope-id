# nope-id

A tiny, secure, URL-friendly unique string ID generator for JavaScript.

**A better alternative to nanoid with extra features!**

- **Secure** - Uses cryptographic random generator
- **Small** - Zero dependencies
- **Fast** - Optimized with byte pool for performance
- **URL-safe** - Uses `A-Za-z0-9_-` characters
- **Dual Module** - Works with both ESM (`import`) and CommonJS (`require`)
- **TypeScript** - Full type definitions included
- **Collision-resistant** - Monotonic sortable IDs, distributed-safe IDs
- **Extra Features** - Prefixed IDs, sortable IDs, UUID v4, and more!

## Installation

```bash
npm install nope-id
```

## Quick Start

### ES Modules (import)

```javascript
import { nopeid } from 'nope-id'

const id = nopeid() // "V1StGXR8_Z5jdHi6B-myT"
```

### CommonJS (require)

```javascript
const { nopeid } = require('nope-id')

const id = nopeid() // "V1StGXR8_Z5jdHi6B-myT"
```

### Default Export

```javascript
// ES Modules
import nopeid from 'nope-id'
const id = nopeid() // "V1StGXR8_Z5jdHi6B-myT"

// CommonJS
const nopeid = require('nope-id')
const id = nopeid() // "V1StGXR8_Z5jdHi6B-myT"
```

---

## API Reference

### Core Functions

#### `nopeid(size = 21)`

Generates a secure, URL-safe unique ID.

```javascript
// ES Modules
import { nopeid } from 'nope-id'

nopeid()    // "V1StGXR8_Z5jdHi6B-myT" (21 characters)
nopeid(10)  // "IRFa-VaY2b" (10 characters)
nopeid(32)  // "V1StGXR8_Z5jdHi6B-myTV1StGXR8_Z5" (32 characters)
nopeid(0)   // "" (empty string for zero/negative)

// CommonJS
const { nopeid } = require('nope-id')
const id = nopeid() // "V1StGXR8_Z5jdHi6B-myT"
```

#### `customAlphabet(alphabet, defaultSize = 21)`

Creates a custom ID generator with your own alphabet.

```javascript
// ES Modules
import { customAlphabet } from 'nope-id'

// Hex IDs
const hexId = customAlphabet('0123456789abcdef', 16)
hexId()   // "4f90d13a42f17f80"
hexId(8)  // "a3b2c1d4"

// Numbers only
const numericId = customAlphabet('0123456789', 8)
numericId() // "48293751"

// Custom characters
const customId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)
customId() // "BKWXYZ"

// Binary IDs
const binaryId = customAlphabet('01', 16)
binaryId() // "1010110011001010"

// CommonJS
const { customAlphabet } = require('nope-id')
const hexGen = customAlphabet('0123456789abcdef', 16)
const id = hexGen() // "4f90d13a42f17f80"
```

#### `customRandom(alphabet, defaultSize, getRandom)`

Creates a custom ID generator with your own random function.

```javascript
// ES Modules
import { customRandom } from 'nope-id'

// Use custom random source
const customGen = customRandom(
  'abcdef',
  10,
  (size) => new Uint8Array(size).fill(1)  // Deterministic for testing
)
customGen() // Deterministic output

// CommonJS
const { customRandom } = require('nope-id')
```

#### `random(bytes)`

Generates cryptographically secure random bytes.

```javascript
// ES Modules
import { random } from 'nope-id'

const bytes = random(16)  // Uint8Array(16) with random bytes
const bytes2 = random(32) // Uint8Array(32) with random bytes

// CommonJS
const { random } = require('nope-id')
const bytes = random(16)
```

---

### ID Generation Functions

#### `prefixedId(prefix, size = 21, separator = '_')`

Generates an ID with a prefix - perfect for database entries!

```javascript
// ES Modules
import { prefixedId } from 'nope-id'

prefixedId('user')           // "user_V1StGXR8_Z5jdHi6B-myT"
prefixedId('order', 10)      // "order_IRFa-VaY2b"
prefixedId('prod', 8, '-')   // "prod-Z5jdHi6B"
prefixedId('cust', 12, ':')  // "cust:a1b2c3d4e5f6"

// Real-world examples
const userId = prefixedId('usr')       // "usr_V1StGXR8_Z5jdHi6B-myT"
const orderId = prefixedId('ord')      // "ord_IRFa-VaY2bKwxyz..."
const productId = prefixedId('prod')   // "prod_Z5jdHi6B-myT..."
const transactionId = prefixedId('txn') // "txn_8_Z5jdHi6B..."

// CommonJS
const { prefixedId } = require('nope-id')
const id = prefixedId('user') // "user_V1StGXR8_Z5jdHi6B-myT"
```

#### `sortableId(size = 22)`

Generates a ULID-like sortable ID with monotonic guarantee. Uses Crockford's Base32 for lexicographic sorting.

**Features:**
- 10 chars timestamp + 12 chars random = 22 chars default
- Chronologically sortable (lexicographic order)
- Same-millisecond IDs are guaranteed monotonically increasing
- Can decode timestamp with `decodeTime()`

```javascript
// ES Modules
import { sortableId, decodeTime } from 'nope-id'

const id1 = sortableId() // "01HGW2BBK0QZRMTX12345A"
// wait some time...
const id2 = sortableId() // "01HGW2BBK1ABCDEFGHIJKL"

// Chronologically sortable
console.log(id1 < id2) // true

// Same millisecond - monotonically increasing
const ids = []
for (let i = 0; i < 5; i++) {
  ids.push(sortableId())
}
// All IDs are unique and strictly increasing
// ids[0] < ids[1] < ids[2] < ids[3] < ids[4]

// Custom size
sortableId(30) // 30 character sortable ID

// Decode timestamp
const id = sortableId()
const date = decodeTime(id)
console.log(date) // Date object when ID was created

// CommonJS
const { sortableId, decodeTime } = require('nope-id')
const id = sortableId()
const timestamp = decodeTime(id)
```

#### `decodeTime(sortableIdStr)`

Extracts the timestamp from a sortable ID.

```javascript
// ES Modules
import { sortableId, decodeTime } from 'nope-id'

const id = sortableId()
const date = decodeTime(id)

console.log(date)            // 2024-01-15T10:30:00.000Z
console.log(date.getTime())  // 1705314600000

// Error handling
try {
  decodeTime('invalid')  // throws Error
} catch (e) {
  console.log('Invalid sortable ID')
}

// CommonJS
const { sortableId, decodeTime } = require('nope-id')
```

#### `generateMany(count, size = 21)`

Generates multiple unique IDs at once.

```javascript
// ES Modules
import { generateMany } from 'nope-id'

const ids = generateMany(5)
// ["V1StGXR8_Z5jdHi6B-myT", "IRFa-VaY2bKwxyz...", ...]

const shortIds = generateMany(100, 8)
// 100 short IDs of 8 characters each

generateMany(0)   // [] (empty array)
generateMany(-5)  // [] (empty array)

// Bulk insert example
const userIds = generateMany(1000, 21)
await db.users.insertMany(
  userIds.map(id => ({ id, createdAt: new Date() }))
)

// CommonJS
const { generateMany } = require('nope-id')
const ids = generateMany(100)
```

#### `uuid()`

Generates a UUID v4 compatible string.

```javascript
// ES Modules
import { uuid } from 'nope-id'

uuid() // "110ec58a-a0f2-4ac4-8393-c866d813b8d1"
uuid() // "f47ac10b-58cc-4372-a567-0e02b2c3d479"

// Use in databases expecting UUID
const user = {
  id: uuid(),
  name: 'John'
}

// CommonJS
const { uuid } = require('nope-id')
const id = uuid()
```

#### `slugId(size = 12)`

Generates a slug-friendly ID (lowercase + numbers only). Perfect for URLs!

```javascript
// ES Modules
import { slugId } from 'nope-id'

slugId()   // "a8b3c9d2e1f4"
slugId(8)  // "x7y2z9w4"
slugId(16) // "a1b2c3d4e5f6g7h8"

// URL-friendly usage
const articleSlug = `my-article-${slugId()}`
// "my-article-a8b3c9d2e1f4"

// CommonJS
const { slugId } = require('nope-id')
const slug = slugId()
```

#### `shortId(size = 8)`

Generates a short ID without similar-looking characters (no 0/O, 1/l/I). Perfect for user-facing codes!

```javascript
// ES Modules
import { shortId } from 'nope-id'

shortId()   // "aBc7XyZ9"
shortId(6)  // "Kp3Wn8"
shortId(10) // "aBc7XyZ9Kp"

// Perfect for:
// - Verification codes
// - Short URLs
// - User-readable references
// - Ticket numbers

const verificationCode = shortId(6) // "Kp3Wn8"
const ticketNumber = shortId(8)     // "aBc7XyZ9"

// CommonJS
const { shortId } = require('nope-id')
const code = shortId(6)
```

#### `nopeidAsync(size = 21)`

Async version for non-blocking operations.

```javascript
// ES Modules
import { nopeidAsync } from 'nope-id'

const id = await nopeidAsync()     // "V1StGXR8_Z5jdHi6B-myT"
const id2 = await nopeidAsync(32)  // 32 character async ID

// Parallel generation
const ids = await Promise.all([
  nopeidAsync(),
  nopeidAsync(),
  nopeidAsync()
])

// CommonJS
const { nopeidAsync } = require('nope-id')
const id = await nopeidAsync()
```

---

### Distributed System Functions

#### `getFingerprint()`

Gets a unique fingerprint for the current process/device. Generated once and cached.

```javascript
// ES Modules
import { getFingerprint } from 'nope-id'

const fp = getFingerprint() // "aB3x" (4 characters)
const fp2 = getFingerprint() // "aB3x" (same value, cached)

// Useful for distributed systems to identify origin
console.log(`ID generated by process: ${getFingerprint()}`)

// CommonJS
const { getFingerprint } = require('nope-id')
const fingerprint = getFingerprint()
```

#### `distributedId(size = 25)`

Generates a distributed-safe ID with process fingerprint. Perfect for multi-node environments!

**Format:** `fingerprint_randomPart`

```javascript
// ES Modules
import { distributedId, getFingerprint } from 'nope-id'

distributedId()   // "aB3x_V1StGXR8_Z5jdHi6B" (25 chars)
distributedId(30) // "aB3x_V1StGXR8_Z5jdHi6B-myT1" (30 chars)

// In a distributed system, each node generates IDs with its own fingerprint
// Node 1: "aB3x_V1StGXR8_Z5jdHi6B"
// Node 2: "kL9m_IRFa-VaY2bKwxyz12"
// Node 3: "pQ7r_Z5jdHi6B-myTV1St8"

// Identify which node generated an ID
const id = distributedId()
const nodeFingerprint = id.split('_')[0]
console.log(`Generated by node: ${nodeFingerprint}`)

// CommonJS
const { distributedId } = require('nope-id')
const id = distributedId()
```

---

### Utility Functions

#### `isValid(id, alphabet = urlAlphabet)`

Validates if a string is a valid ID for the given alphabet.

```javascript
// ES Modules
import { isValid, urlAlphabet, alphabets } from 'nope-id'

isValid('V1StGXR8_Z5jdHi6B-myT')  // true
isValid('')                        // false
isValid(null)                      // false
isValid('abc@#$')                  // false (invalid chars)

// Validate with custom alphabet
isValid('abc123', 'abc123')        // true
isValid('ABC', 'abc')              // false
isValid('12345678', alphabets.numbers) // true

// CommonJS
const { isValid } = require('nope-id')
const valid = isValid('V1StGXR8_Z5jdHi6B-myT')
```

#### `collisionProbability(idLength, alphabetSize = 64)`

Calculate collision probability for given parameters.

```javascript
// ES Modules
import { collisionProbability } from 'nope-id'

const info = collisionProbability(21)
console.log(info)
// {
//   totalPossible: 4.7e+37,        // Total unique IDs possible
//   probabilityForBillion: 1.06e-20, // Collision chance for 1B IDs
//   safeCount: 8.1e+18,            // Safe number of IDs (50% collision)
//   yearsFor1Percent: 1.5e+12      // Years at 1 ID/ms for 1% collision
// }

// Compare different lengths
collisionProbability(8)   // Much higher collision risk
collisionProbability(32)  // Very low collision risk

// Custom alphabet size
collisionProbability(21, 62)  // Alphanumeric only
collisionProbability(21, 16)  // Hex only

// CommonJS
const { collisionProbability } = require('nope-id')
const info = collisionProbability(21)
```

---

### Pre-built Alphabets

```javascript
// ES Modules
import { alphabets, customAlphabet } from 'nope-id'

// Available alphabets
alphabets.alphanumeric    // "0-9A-Za-z" (62 chars)
alphabets.lowercase       // "a-z" (26 chars)
alphabets.uppercase       // "A-Z" (26 chars)
alphabets.numbers         // "0-9" (10 chars)
alphabets.hexLower        // "0-9a-f" (16 chars)
alphabets.hexUpper        // "0-9A-F" (16 chars)
alphabets.nolookalikes    // No confusing chars (49 chars)
alphabets.nolookalikesSafe // Extra safe version (34 chars)
alphabets.binary          // "01" (2 chars)
alphabets.octal           // "0-7" (8 chars)
alphabets.base32          // RFC 4648 Base32 (32 chars)
alphabets.base32Lower     // Lowercase Base32 (32 chars)
alphabets.base58          // Bitcoin Base58 (58 chars)
alphabets.filename        // Filename-safe (64 chars)

// Usage with customAlphabet
const hexGen = customAlphabet(alphabets.hexLower, 32)
hexGen() // "a1b2c3d4e5f67890abcdef1234567890"

const base58Gen = customAlphabet(alphabets.base58, 22)
base58Gen() // Bitcoin-style ID

const safeGen = customAlphabet(alphabets.nolookalikesSafe, 8)
safeGen() // Very readable code

// CommonJS
const { alphabets, customAlphabet } = require('nope-id')
const gen = customAlphabet(alphabets.hexLower, 16)
```

---

## Non-Secure Version

For non-critical use cases (UI element IDs, temporary keys, etc.), you can use the faster non-secure version:

```javascript
// ES Modules
import { nopeid, sortableId, prefixedId } from 'nope-id/non-secure'

nopeid()      // Uses Math.random() - faster but not cryptographically secure
sortableId()  // Still has monotonic guarantee
prefixedId('user') // Still works the same way

// CommonJS
const { nopeid, sortableId } = require('nope-id/non-secure')
const id = nopeid()
```

**Warning:** Do not use for security-sensitive purposes like tokens, passwords, or session IDs!

**Use cases for non-secure version:**
- UI element IDs (React keys, etc.)
- Temporary file names
- Log correlation IDs
- Test fixtures
- Any case where cryptographic security is not required

---

## Real-World Examples

### Database Primary Keys

```javascript
// ES Modules
import { prefixedId, sortableId } from 'nope-id'

// User table with prefixed IDs
const user = {
  id: prefixedId('usr'),  // "usr_V1StGXR8_Z5jdHi6B-myT"
  email: 'john@example.com'
}

// Orders with sortable IDs (auto-sorted by creation time)
const order = {
  id: sortableId(),  // "01HGW2BBK0QZRMTX12345A"
  userId: user.id,
  total: 99.99
}

// CommonJS
const { prefixedId, sortableId } = require('nope-id')
```

### API Token Generation

```javascript
// ES Modules
import { nopeid, prefixedId } from 'nope-id'

// API keys
const apiKey = prefixedId('sk', 32)  // "sk_V1StGXR8_Z5jdHi6B-myTV1StGXR8_"

// Refresh tokens
const refreshToken = nopeid(64)  // 64 char secure token

// CommonJS
const { nopeid, prefixedId } = require('nope-id')
```

### URL Shortener

```javascript
// ES Modules
import { slugId, shortId } from 'nope-id'

// Short URLs
const shortUrl = `https://short.ly/${slugId(8)}`
// "https://short.ly/a8b3c9d2"

// User-friendly codes
const shareCode = shortId(6)  // "Kp3Wn8" (no confusing characters)

// CommonJS
const { slugId, shortId } = require('nope-id')
```

### Distributed Systems

```javascript
// ES Modules
import { distributedId, sortableId, getFingerprint } from 'nope-id'

// Multi-node safe IDs
const eventId = distributedId()
// "aB3x_V1StGXR8_Z5jdHi6B"

// Log with node identification
console.log(`[${getFingerprint()}] Processing event ${eventId}`)

// Time-series data with sortable IDs
const metric = {
  id: sortableId(),
  timestamp: new Date(),
  value: 42
}

// CommonJS
const { distributedId, getFingerprint } = require('nope-id')
```

### React / Next.js

```jsx
// ES Modules (React)
import { nopeid, prefixedId } from 'nope-id'

function TodoList({ items }) {
  return (
    <ul>
      {items.map(item => (
        <li key={nopeid()}>{item.text}</li>
      ))}
    </ul>
  )
}

function CreateUser() {
  const [userId] = useState(() => prefixedId('usr'))
  // ...
}

// For non-critical UI keys, use non-secure version for better performance
import { nopeid } from 'nope-id/non-secure'
```

### Express.js API

```javascript
// CommonJS
const express = require('express')
const { prefixedId, sortableId, uuid } = require('nope-id')

const app = express()

app.post('/users', (req, res) => {
  const user = {
    id: prefixedId('usr'),
    ...req.body
  }
  // Save user...
  res.json(user)
})

app.post('/orders', (req, res) => {
  const order = {
    id: sortableId(),  // Sortable by creation time
    ...req.body
  }
  // Save order...
  res.json(order)
})

// For systems expecting UUID
app.post('/legacy-api', (req, res) => {
  const record = {
    id: uuid(),
    ...req.body
  }
  res.json(record)
})
```

---

## Comparison with nanoid

| Feature | nope-id | nanoid |
|---------|---------|--------|
| Secure random | ✅ | ✅ |
| URL-safe | ✅ | ✅ |
| TypeScript | ✅ | ✅ |
| ESM + CJS | ✅ | ✅ |
| Prefixed IDs | ✅ | ❌ |
| Sortable IDs (ULID-like) | ✅ | ❌ |
| Monotonic guarantee | ✅ | ❌ |
| Timestamp decoding | ✅ | ❌ |
| Distributed IDs | ✅ | ❌ |
| Process fingerprint | ✅ | ❌ |
| UUID v4 | ✅ | ❌ |
| Slug IDs | ✅ | ❌ |
| Short IDs (no lookalikes) | ✅ | ❌ |
| Batch generation | ✅ | ❌ |
| Validation | ✅ | ❌ |
| Collision calculator | ✅ | ❌ |
| Pre-built alphabets | ✅ (14) | Limited |

---

## Browser Support

Works in all modern browsers with Web Crypto API support.

```html
<script type="module">
  import { nopeid, prefixedId } from 'https://unpkg.com/nope-id/index.browser.js'

  console.log(nopeid())        // "V1StGXR8_Z5jdHi6B-myT"
  console.log(prefixedId('user')) // "user_V1StGXR8_..."
</script>
```

---

## Security

nope-id uses:
- `webcrypto.getRandomValues()` in Node.js
- `crypto.getRandomValues()` in browsers

Both are cryptographically secure random number generators (CSPRNG).

**Best Practices:**
- Use the secure version (default) for tokens, session IDs, API keys
- Use `sortableId()` for time-based ordering with collision resistance
- Use `distributedId()` in multi-node deployments
- Only use `nope-id/non-secure` for non-security-critical purposes

---

## Performance

### nope-id vs nanoid Benchmark

Run the benchmark yourself:

```bash
npm run benchmark
```

**Results (Node.js v20+, 100,000 iterations):**

| Test | nanoid | nope-id | Winner |
|------|--------|---------|--------|
| Basic (21 chars) | ~5.3M ops/sec | ~5.3M ops/sec | Tie |
| Small (10 chars) | ~10.9M ops/sec | ~11M ops/sec | **nope-id** |
| Large (64 chars) | ~2.2M ops/sec | ~2.4M ops/sec | **nope-id** (~10% faster) |
| Custom Alphabet | ~5.3M ops/sec | ~5.3M ops/sec | Tie |
| Batch (100 IDs) | ~64K ops/sec | ~64K ops/sec | Tie |

**Result: nope-id matches or beats nanoid** while providing many extra features!

### Extra Features Performance

These features are exclusive to nope-id (nanoid doesn't have them):

| Feature | Performance |
|---------|-------------|
| `sortableId()` | ~2-4M ops/sec |
| `prefixedId()` | ~4-5M ops/sec |
| `uuid()` | ~4M ops/sec |
| `slugId()` | ~3-4M ops/sec |
| `shortId()` | ~6-7M ops/sec |

### Why nope-id is Fast

- **Byte Pool**: Minimizes crypto system calls by pre-allocating random bytes
- **Optimized Masks**: Uses bitwise operations for alphabet mapping
- **Pre-cached Generators**: Common functions like `slugId()` and `shortId()` use cached generators
- **Zero Dependencies**: No external library overhead

---

## License

MIT
