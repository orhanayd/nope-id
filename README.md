# nope-id

A tiny, secure, URL-friendly unique string ID generator for JavaScript.

**A faster, more secure alternative to nanoid with extra features!**

- **Faster** - Up to ~20% faster than nanoid; wins all 5 core benchmarks ([see benchmarks](#performance))
- **Security Hardened** - Timing attack prevention, modulo bias elimination, prototype pollution protection ([see security](#security))
- **Well Tested** - 307 tests including security & entropy tests ([see testing](#testing))
- **Cryptographically Secure** - Uses `webcrypto.getRandomValues()` (CSPRNG)
- **Zero Dependencies** - No external dependencies
- **URL-safe** - Uses `A-Za-z0-9_-` characters
- **Dual Module** - Works with both ESM (`import`) and CommonJS (`require`)
- **TypeScript** - Full type definitions included
- **Collision-resistant** - Monotonic sortable IDs, distributed-safe IDs
- **Many ID Formats** - UUID v4 & **v7**, **ULID** (spec-compliant + monotonic factory), **Snowflake**, **MongoDB ObjectId**
- **Extra Features** - Prefixed IDs, sortable IDs, **Sqids** (reversible encoding), **typed IDs**, format validators, and more!

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
- Sizes > 22 are padded with extra Crockford Base32 random chars; sizes < 22 truncate to the timestamp prefix (use size ≥ 22 to keep the monotonic guarantee)

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
//   totalPossible: 9007199254740991,   // clamped to MAX_SAFE_INTEGER (use totalPossibleBigInt for exact)
//   totalPossibleBigInt: 85070591730234615865843651857942052864n, // 64^21 ≈ 8.5e37
//   probabilityForBillion: 0,          // ~5.9e-21, rounds to 0 in double precision
//   safeCount: 1.086e+19,              // ~50% collision after generating this many IDs
//   yearsFor1Percent: 4.133e+7         // years at 1 ID/ms before 1% collision
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

## Additional ID Formats & Helpers

These secure-only generators and helpers are exposed as tree-shakeable named exports and **never touch the hot path** of `nopeid()`; import only what you use.

### `uuidv7()`

Time-ordered UUID (RFC 9562), database-index friendly and sortable by creation time. The first 48 bits encode the Unix-ms timestamp.

```javascript
import { uuidv7, isValidUUID } from 'nope-id'

uuidv7()                  // "0192f3c1-8e2a-7b3c-9d4e-5f60718293a4"
isValidUUID(uuidv7(), 7)  // true
```

### `ulid(seedTime?)` & `monotonicFactory()`

Spec-compliant 26-char ULID (Crockford Base32: 10 timestamp + 16 random). `ulid()` uses fresh randomness per call; `monotonicFactory()` returns a generator with **isolated** state that guarantees strictly increasing IDs within the same millisecond (without touching the global `sortableId()` state).

```javascript
import { ulid, monotonicFactory, decodeTime } from 'nope-id'

ulid()              // "01ARZ3NDEKTSV4RRFFQ69G5FAV"
decodeTime(ulid())  // Date

const next = monotonicFactory()
next() < next()     // true (same ms, strictly increasing)
```

### `snowflakeFactory(options)`, `snowflake()` & `decodeSnowflake(id)`

Twitter-style 64-bit distributed IDs returned as **strings** (BigInt-safe). Layout: 41-bit timestamp · 10-bit node id · 12-bit sequence. Each factory owns its own sequence state (coordination-free per node).

```javascript
import { snowflakeFactory, decodeSnowflake, snowflake } from 'nope-id'

const next = snowflakeFactory({ nodeId: 1 })  // optional: { epoch }
const id = next()                              // "1838219834728448001"
decodeSnowflake(id)  // { timestamp: Date, nodeId: 1, sequence: 0 }

snowflake()  // default single-node generator (node id derived from fingerprint)
```

### `objectId()` & `decodeObjectIdTime(id)`

MongoDB ObjectId-compatible 24-char hex (4-byte timestamp + 5-byte per-process value + 3-byte counter).

```javascript
import { objectId, decodeObjectIdTime } from 'nope-id'

objectId()                      // "65f1c3e2a1b2c3d4e5f60718"
decodeObjectIdTime(objectId())  // Date
```

### `sqidsFactory(options)`: reversible integer encoding

Encode arrays of non-negative integers into short, URL-safe, **reversible** strings, for example to hide sequential database IDs in URLs. This is obfuscation, **not** encryption.

```javascript
import { sqidsFactory } from 'nope-id'

const sqids = sqidsFactory()        // { alphabet?, minLength?, blocklist? }
const id = sqids.encode([1, 2, 3])  // "86Rf07"
sqids.decode(id)                    // [1, 2, 3]
```

> The default has **no** profanity blocklist (to stay tiny). Pass your own `blocklist` if you need one.

### `defineId(prefix, options?)`: typed prefixed IDs

Stripe-style typed IDs with a generator, a type guard, and a parser. In TypeScript the generated id is typed as `` `${prefix}_${string}` ``.

```typescript
import { defineId } from 'nope-id'

const UserId = defineId('user')   // { size?, separator?, alphabet? }
const id = UserId.generate()      // type: `user_${string}`
UserId.is(id)                     // true (type guard narrows the type)
UserId.parse('user_abc')          // { prefix: 'user', id: 'abc' }  (or null)
```

### `isValidUUID(id, version?)` & `isValidULID(id)`

Format validators for UUID and ULID strings.

```javascript
import { isValidUUID, isValidULID } from 'nope-id'

isValidUUID('110ec58a-a0f2-4ac4-8393-c866d813b8d1')  // true
isValidUUID(uuidv7(), 7)                              // true (version-pinned)
isValidULID('01ARZ3NDEKTSV4RRFFQ69G5FAV')             // true
```

> These formats use cryptographic randomness and are **secure-version only**; they are not part of `nope-id/non-secure`.

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
| ESM + CommonJS | ✅ | ⚠️ ESM-only (dropped CJS in v4) |
| Prefixed IDs | ✅ | ❌ |
| Sortable IDs (ULID-like) | ✅ | ❌ |
| Monotonic guarantee | ✅ | ❌ |
| Timestamp decoding | ✅ | ❌ |
| Distributed IDs | ✅ | ❌ |
| Process fingerprint | ✅ | ❌ |
| UUID v4 | ✅ | ❌ |
| UUID v7 (time-ordered) | ✅ | ❌ |
| ULID (spec-compliant) | ✅ | ❌ |
| Monotonic ULID factory | ✅ | ❌ |
| Snowflake IDs | ✅ | ❌ |
| MongoDB ObjectId | ✅ | ❌ |
| Sqids (reversible encoding) | ✅ | ❌ |
| Typed IDs (TS template types) | ✅ | ❌ |
| Format validators (UUID/ULID) | ✅ | ❌ |
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

nope-id is designed with security as a top priority. We've implemented multiple security hardening measures that go beyond basic cryptographic randomness.

### Cryptographic Security

- **Node.js**: `webcrypto.getRandomValues()` (CSPRNG)
- **Browser**: `crypto.getRandomValues()` (CSPRNG)

### Security Hardening

| Security Feature | Description |
|-----------------|-------------|
| **Timing Attack Prevention** | `isValid()` uses constant-time comparison to prevent timing side-channel attacks that could leak information about valid characters |
| **Modulo Bias Elimination** | Uses rejection sampling to ensure perfectly uniform distribution for all alphabet sizes (not just powers of 2) |
| **Prototype Pollution Protection** | `alphabets` object is frozen with null prototype - immune to prototype pollution attacks |
| **Integer Overflow Protection** | `collisionProbability()` uses BigInt for accurate calculations with astronomically large numbers |
| **DoS Prevention** | `sortableId()` has iteration limits to prevent infinite loops from frozen system clocks |
| **Buffer Safety** | Pool management handles `>65536` byte requests safely with chunked filling |

### Best Practices

- Use the secure version (default) for tokens, session IDs, API keys
- Use `sortableId()` for time-based ordering with collision resistance
- Use `distributedId()` in multi-node deployments
- Only use `nope-id/non-secure` for non-security-critical purposes

---

## Testing

nope-id has comprehensive test coverage with **307 tests** across 6 test suites, including security-specific tests.

### Run Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:core        # Core functions (nopeid, customAlphabet, random)
npm run test:features    # Features (prefixedId, sortableId, uuid, etc.)
npm run test:utils       # Utilities (isValid, collisionProbability)
npm run test:non-secure  # Non-secure version tests
npm run test:idtypes     # New ID types (uuidv7, ulid, snowflake, objectId)
npm run test:encoding    # Sqids, typed IDs, format validators
```

### Test Coverage

| Test Suite | Tests | Description |
|------------|-------|-------------|
| **Core** | 81 | nopeid, customAlphabet, customRandom, random, alphabets |
| **Features** | 78 | prefixedId, sortableId, uuid, slugId, shortId, distributedId |
| **Utils** | 56 | isValid, collisionProbability, security tests |
| **Non-Secure** | 29 | Math.random() based version |
| **ID Types** | 31 | uuidv7, ulid, monotonicFactory, snowflake, objectId |
| **Encoding** | 32 | sqids, defineId, isValidUUID, isValidULID |
| **Total** | **307** | All tests passing |

### Security Tests

We have dedicated security tests that verify our hardening measures:

```
📦 isValid() Security
  ✅ rejects strings with null bytes
  ✅ rejects strings with unicode zero-width chars
  ✅ constant-time validation (timing attack prevention)

📦 Prototype Pollution Prevention
  ✅ alphabets object is frozen
  ✅ alphabets has null prototype
  ✅ alphabets cannot be modified
  ✅ alphabets does not inherit Object.prototype properties

📦 Modulo Bias Prevention (customAlphabet)
  ✅ uniform distribution for non-power-of-2 alphabet
  ✅ uniform distribution for 3-char alphabet

📦 Integer Overflow Prevention
  ✅ collisionProbability returns BigInt for large values
  ✅ BigInt is accurate for values exceeding MAX_SAFE_INTEGER
  ✅ totalPossible is clamped to MAX_SAFE_INTEGER

📦 Security: Entropy Quality
  ✅ random bytes have good entropy distribution
  ✅ generated IDs have good character distribution
  ✅ no predictable patterns in sequential IDs
  ✅ chi-square test for randomness
```

### Stress Tests

```
📦 Stress Tests
  ✅ rapid sequential generation (10000 IDs) - all unique
  ✅ pool exhaustion and refill cycle
  ✅ varying sizes in sequence
  ✅ alternating between different generators
```

### Randomness Comparison Test (vs nanoid)

We have a dedicated randomness comparison test against nanoid:

```bash
npm run test:randomness
```

| Test | nope-id | nanoid |
|------|---------|--------|
| Chi-Square Distribution | ✅ χ²=56.12 | ✅ χ²=49.75 |
| Uniqueness (100K IDs) | ✅ 0 duplicates | ✅ 0 duplicates |
| Bit Distribution | ✅ 50.06/49.94% | ✅ 49.88/50.12% |
| Sequential Correlation | ✅ 0.319 avg | ✅ 0.329 avg |
| Alphabet Coverage | ✅ 64/64 (100%) | ✅ 64/64 (100%) |
| Modulo Bias (3-char) | ✅ 0.47% deviation | ✅ 0.94% deviation |

---

## Performance

### nope-id vs nanoid Benchmark

**nope-id wins all 5 core benchmarks vs nanoid 5.1.11**, and ships many extra ID formats and security hardening on top.

Run the benchmark yourself:

```bash
npm run benchmark
```

**Results (Node.js 20+, nanoid 5.1.11, auto-calibrated ~120 ms × best of 7 trials, with a global warmup for fairness; absolute numbers vary by machine):**

| Test | nanoid 5.1.11 | nope-id | Winner |
|------|--------|---------|--------|
| Basic (21 chars) | ~6.6M ops/sec | **~7.45M ops/sec** | **nope-id ~+13%** |
| Small (10 chars) | ~12.6M ops/sec | **~13.8M ops/sec** | **nope-id ~+9%** |
| Large (64 chars) | ~2.65M ops/sec | **~3.15M ops/sec** | **nope-id ~+18%** |
| Custom Alphabet | ~7.35M ops/sec | **~8.9M ops/sec** | **nope-id ~+21%** |
| Batch (100 IDs) | ~70K ops/sec | **~80K ops/sec** | **nope-id ~+15%** |

**Result: nope-id wins 5/5 against nanoid** for URL-safe IDs, while providing many extra features and security hardening.

### UUID generation vs the `uuid` package and native `crypto.randomUUID()`

A benchmark is only meaningful against more than one tool (thanks to nanoid's author for the nudge in [#4](https://github.com/orhanayd/nope-id/issues/4)). Here's the honest picture for UUIDs:

| Generator | ops/sec | |
|---|---|---|
| `crypto.randomUUID()` (Node native, v4) | **~25M** | 🥇 fastest for plain v4 |
| nope-id `uuid()` (v4) | ~7.8M | edges out the `uuid` package |
| `uuid` package `v4()` | ~7.5M | |
| nope-id `uuidv7()` | ~6.4M | **~6× the `uuid` package's v7** |
| `uuid` package `v7()` | ~1M | |

**Honest take:** if all you need is a random v4 UUID, **Node's built-in `crypto.randomUUID()` is by far the fastest, so use it.** nope-id doesn't try to beat native there. Its value is **breadth**: UUIDv7, ULID, Snowflake, ObjectId, Sqids, typed IDs and nanoid-style short IDs (most of which the `uuid` package and native don't offer), plus being faster than nanoid for URL-safe IDs and faster than the `uuid` package (especially v7), all dual-module and zero-dependency.

### ULID (sortable) vs the `ulid` package

ULIDs are an attractive alternative to UUIDs: **lexicographically sortable**, a compact **26 characters** (vs UUID's 36), Crockford base32 (URL-safe, case-insensitive), 128-bit and UUID-compatible, with a monotonic option that handles the same millisecond correctly. Unlike random UUID v4, their time prefix keeps database indexes from fragmenting.

nope-id ships a spec-compliant `ulid()` plus an isolated `monotonicFactory()`. Same 26-char format as the `ulid` package, both crypto-backed:

| Generator | ops/sec |
|---|---|
| nope-id `ulid()` | **~2.9M** |
| `ulid` package | ~55K |
| nope-id `monotonicFactory()` | **~3.1M** |
| `ulid` package (monotonic) | ~2.2M |

nope-id is far faster for plain `ulid()` because it draws randomness from a pooled buffer (one fill per 16 IDs), whereas the `ulid` package fetches randomness per character. Decode the timestamp from either with `decodeTime()`. (The `ulid` package is also zero-dependency.)

### cuid2: a different goal

[`@paralleldrive/cuid2`](https://github.com/paralleldrive/cuid2) is **deliberately not fast**. It hashes (SHA-3) several independent entropy sources into **unguessable, horizontally-scalable** IDs, and throttles its speed on purpose, because an ID that hashes too quickly lets an attacker brute-force collisions or entropy in parallel. Its own README points to nanoid or ulid when you need raw performance, which is precisely nope-id's space.

| Generator | ops/sec | |
|---|---|---|
| nope-id `nopeid()` | ~7.5M | CSPRNG random, URL-safe, 0 deps |
| cuid2 `createId()` | ~7K | hash-based, throttled by design, 3 deps |

So this is not really a head-to-head: if you want cuid2's hardened, sharding-safe guarantees, the cost is intended. nope-id fills the fast, format-rich, zero-dependency niche that cuid2 itself recommends for performance-sensitive code, while still drawing every random bit from a CSPRNG.

### Extra Features Performance

These features are exclusive to nope-id (nanoid doesn't have them):

| Feature | Performance |
|---------|-------------|
| `sortableId()` | ~5M ops/sec |
| `prefixedId()` | ~7.2M ops/sec |
| `uuid()` | ~7.9M ops/sec |
| `slugId()` | ~5.6M ops/sec |
| `shortId()` | ~11.9M ops/sec |
| `uuidv7()` | ~6.4M ops/sec |
| `ulid()` | ~3M ops/sec |
| `monotonicFactory()` | ~3.2M ops/sec |
| `snowflake` (factory) | ~4.1M ops/sec |
| `objectId()` | ~9.1M ops/sec |
| `sqids.encode()` | ~0.32M ops/sec |

### Why nope-id is Fast

- **Pre-computed Lookup Tables**: Array access instead of string indexing for O(1) character lookup
- **Inlined Hot Paths**: Critical functions like pool management are inlined to eliminate function call overhead
- **Optimized Pool Management**: Pre-allocates 128x buffer size to minimize crypto API calls
- **Bitwise Operations**: Uses `& mask` for fast alphabet index mapping
- **Pre-cached Generators**: Common functions like `slugId()` and `shortId()` use cached generators
- **Precomputed Hex & Crockford Tables**: `uuid()`/`uuidv7()`/`objectId()`/`ulid()` format via byte→hex and char-code tables instead of per-byte conversion
- **Allocation-free `customAlphabet`**: reads the shared byte pool directly (no per-call view allocation), which also speeds up `slugId()` and `shortId()`
- **Zero Dependencies**: No external library overhead

---

## Disclaimer

While nope-id uses cryptographically secure random number generators (`crypto.getRandomValues`) and implements security best practices, **no software can guarantee 100% randomness or absolute security**. The quality of randomness ultimately depends on the underlying operating system's entropy source.

For extremely high-security applications (e.g., cryptographic keys, long-term secrets), consider using dedicated cryptographic libraries that have undergone formal security audits.

nope-id is provided "as is" without warranty of any kind. Always evaluate whether it meets your specific security requirements.

---

## License

MIT
