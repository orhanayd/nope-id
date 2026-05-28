# nope-id

> 🌐 **Read in another language:** [English](README.md) · [Türkçe](README.tr.md) · [Русский](README.ru.md)

A tiny, secure, URL-friendly unique string ID generator for JavaScript.

**A faster, more secure alternative to nanoid with extra features!**

<!-- bench:headline:start -->
- **Faster** - 4x to 8x faster than nanoid (CSPRNG, full URL-safe alphabet); wins all 5 core benchmarks ([see benchmarks](#performance))
<!-- bench:headline:end -->
- **Security Hardened** - Reduced timing-leak validators, modulo bias elimination, prototype pollution protection ([see security](#security))
- **Well Tested** - 342 tests including security & entropy tests ([see testing](#testing))
- **Cryptographically Secure** - Uses `webcrypto.getRandomValues()` (CSPRNG)
- **Zero Dependencies** - No external dependencies
- **URL-safe** - Uses `A-Za-z0-9_-` characters
- **Dual Module** - Works with both ESM (`import`) and CommonJS (`require`)
- **TypeScript** - Full type definitions included
- **Collision-resistant** - Strictly-monotonic sortable IDs, origin-tagged distributed IDs
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

> **Legacy API.** Prefer [`orderedId()`](#orderedid) for new sortable IDs.

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

Generates an ID with a process-fingerprint prefix. Useful for tracing ID origin in multi-process or multi-node systems. Collision resistance comes from the random tail, so `size` must leave room for it (minimum 16; smaller values throw).

**Format:** `fingerprint_randomPart`

```javascript
// ES Modules
import { distributedId, getFingerprint } from 'nope-id'

distributedId()   // "aB3x_V1StGXR8_Z5jdHi6B" (25 chars)
distributedId(30) // "aB3x_V1StGXR8_Z5jdHi6B-myT1" (30 chars)
distributedId(8)  // throws — size must be >= 16

// In multi-process / multi-node systems, each origin's IDs carry its fingerprint
// Node 1: "aB3x_V1StGXR8_Z5jdHi6B"
// Node 2: "kL9m_IRFa-VaY2bKwxyz12"
// Node 3: "pQ7r_Z5jdHi6B-myTV1St8"

// Identify which origin generated an ID
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
//   probabilityForBillion: 5.877471748233966e-21, // accurately computed via Math.expm1
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

## Sortable, monotonic IDs

### `orderedId()`

A fixed-format, strictly-monotonic, lexicographically-sortable 21-char Base58 ID. Layout: 8 timestamp + 5 counter + 8 random.

Same shape as [sparkid](https://www.npmjs.com/package/sparkid), with one extra char of random entropy (~47 bits vs sparkid's ~41), stronger invariants (clock-rewind clamp, synthetic-time counter overflow instead of busy-wait), and comparable throughput within run-to-run noise on Node LTS (see [Benchmarks](#benchmarks)).

```javascript
import { orderedId } from 'nope-id'

orderedId()                                // "1okw67hF111114mDXU1ez"

// Strict monotonicity holds across NTP corrections, container resumes, etc.
// When Date.now() goes backwards, orderedId reuses the larger cached prefix
// and keeps advancing the counter, so the next ID is still strictly greater.
orderedId() < orderedId() // true

// Parse the time, counter, and random tail back out
orderedId.parse('1okw67hF111114mDXU1ez')
// { timestamp: Date, counter: 1, random: '4mDXU1ez' }

// 21-byte ASCII representation (latin1 char codes; NOT packed binary)
orderedId.asciiBytes() // Uint8Array(21)
```

**When to choose `orderedId()` over `sortableId()`:**
- It is strictly monotonic (`b > a`), not just non-decreasing.
- Counter overflow does a synthetic time bump instead of a busy-wait loop.
- Clock rewind is clamped — never emits a smaller timestamp than what it already returned.
- Output is always 21 chars; no size parameter, no truncation foot-guns.

`sortableId()` is now legacy. Prefer `orderedId()` for new code.

> orderedId is sortable by design — its prefix reveals creation time. **Don't use it as a bearer secret.** For secrets, use `secureToken()`.

---

## Secure tokens (bearer secrets)

`nopeid()` returns substrings of a long-lived cached pool string for throughput. That cache is fine for public IDs, but for bearer secrets (API keys, session tokens, password-reset tokens) it means a memory dump could expose tokens that have not yet been requested. The `secureToken` family defeats that class of risk: each call allocates its own buffer, fills from CSPRNG, maps to the alphabet, then zeros the raw bytes before returning.

> The returned JavaScript string itself cannot be zeroized — V8 strings are immutable and live in the GC heap. If your threat model requires memory-clearable secrets, keep the bytes as `Buffer`/`Uint8Array` and never `.toString()`.

### `secureToken(size = 48)`

```javascript
import { secureToken } from 'nope-id'

secureToken()       // 48-char URL-safe token (default)
secureToken(64)     // 64-char token
secureToken(32)     // 32 is the minimum; anything smaller throws
```

- URL-safe 64-char alphabet (`A-Za-z0-9_-`)
- Bias-free (`byte & 63`)
- No future-token cache; raw bytes zeroized after stringification
- **Store hashed tokens** (e.g. SHA-256), never the raw token

### `apiKey(prefix = 'nope_live', size = 40)`

```javascript
import { apiKey } from 'nope-id'

apiKey()                       // "nope_live_<40 chars>"
apiKey('sk_live', 40)          // "sk_live_<40 chars>"
apiKey('myapp_test', 32)       // "myapp_test_<32 chars>"
```

A thin wrapper over `secureToken`: validates the prefix (non-empty, no whitespace) and joins with `_`. Naming convention (Stripe-style `sk_live_`, GitHub-style `ghp_`, etc.) is up to you.

### `defineToken(prefix, options?)`: typed secure tokens

Stripe-style: a `generate` / `is` / `parse` triple, but the body comes from `secureToken` and the alphabet is fixed to URL-safe 64-char for stability.

```javascript
import { defineToken } from 'nope-id'

const SessionToken = defineToken('sess', { size: 48 })

const t = SessionToken.generate()    // "sess_<48 chars>"
SessionToken.is(t)                   // true
SessionToken.parse(t)                // { prefix: 'sess', token: '<48 chars>' }
SessionToken.is('sess_short')        // false (length is enforced)
```

---

## Choose the right ID

| Use case | API | Size | Why |
|---|---|---|---|
| Log / request ID | `nopeid(16)` | 16 | Fastest, pooled, public-safe |
| Public URL ID | `nopeid(21)` | 21 | 126 bits, no future-token issues for public IDs |
| DB object ID | `nopeid(21)` or `orderedId()` | 21 | Random or sortable |
| Sortable DB primary key | `orderedId()` | 21 | Lex-sortable, strictly monotonic, B-tree friendly |
| Invite / verification code | `shortId(12)` | 12 | No look-alikes, user-typeable |
| API key | `apiKey('myapp_live', 40)` | prefix + 40 | Prefixed, unpooled, 240+ bits |
| Session token | `secureToken(48)` | 48 | Unpooled, ephemeral |
| Password reset token | `secureToken(48)` | 48 | One-time use; hash before storage |
| Email verification | `secureToken(40)` | 40 | TTL + one-time use |
| Payment / high-value | `secureToken(64)` | 64 | Maximum entropy budget |

Net rule:
- **Pooled, fast, public-safe** → `nopeid()` family
- **Unpooled, ephemeral, server secret** → `secureToken()` family
- **Time-ordered, monotonic, DB-friendly** → `orderedId()`

---

## Security profiles

- `nopeid()` is optimized for public, non-secret identifiers. The pooled string cache may hold a window of future-ID material in memory; acceptable for public IDs, inappropriate for bearer secrets.
- `orderedId()` is optimized for sortable, monotonic identifiers and intentionally reveals creation time in its prefix. Not a secret; safe to expose. For performance it draws its 8-char random tail from a pooled cache (refilled in bulk from CSPRNG), so a memory dump may contain future random-tail material — acceptable because `orderedId()` is not a bearer secret. Use `secureToken()` when unguessability of yet-unissued values matters.
- `secureToken()` is optimized for bearer secrets. No future-token cache; raw bytes are zeroized after stringification (the returned string itself cannot be zeroed — JavaScript limitation).
- `apiKey()` and `defineToken()` are convenience wrappers over `secureToken()` — same security profile, plus a stable prefix.
- `objectId()`, `uuidv7()`, `ulid()`, `snowflake()`, `sqids()` are **structured identifiers**, not bearer secrets — they encode time/sequence/machine-id and must not be used where unguessability matters.
- `sortableId()` is legacy; prefer `orderedId()` for new code.

> **Benchmarks policy.** A "faster than X" claim against `sparkid`, `nanoid`, `ulid`, etc. is only written into this README if the Benchmarks section measurements on the same machine / Node version / harness back it up. Otherwise we say "comparable performance". `orderedId()` vs `sparkid` on Node 22 sits inside ±1.5% median across 15 best-of-7 trials (`benchmarks/orderedid-vs-sparkid.bench.js`), so the wording is "comparable throughput".

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
import { prefixedId, orderedId } from 'nope-id'

// User table with prefixed IDs
const user = {
  id: prefixedId('usr'),  // "usr_V1StGXR8_Z5jdHi6B-myT"
  email: 'john@example.com'
}

// Orders with sortable, strictly-monotonic IDs (auto-sorted by creation time)
const order = {
  id: orderedId(),  // "1okw67hF111114mDXU1ez"
  userId: user.id,
  total: 99.99
}

// CommonJS
const { prefixedId, orderedId } = require('nope-id')
```

### API Token Generation

```javascript
// ES Modules
import { apiKey, secureToken, defineToken } from 'nope-id'

// Prefixed API key (unpooled, ephemeral, prefix validated)
const key = apiKey('sk_live', 40)        // "sk_live_<40 chars>"

// Refresh / session / password-reset tokens
const refreshToken = secureToken(48)     // 48-char URL-safe, CSPRNG, zeroized

// Typed token with a generate / is / parse triple
const SessionToken = defineToken('sess', { size: 48 })
const sessionToken = SessionToken.generate()

// CommonJS
const { apiKey, secureToken, defineToken } = require('nope-id')
```

> The `secureToken` family bypasses the `nopeid()` string pool — each call is its own CSPRNG fill, so a memory dump cannot reveal tokens that have not yet been issued. Use it for any bearer secret. Use `nopeid()` / `prefixedId()` for public IDs only.

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
import { distributedId, orderedId, getFingerprint } from 'nope-id'

// Origin-tagged IDs (fingerprint prefix lets you trace which process emitted them)
const eventId = distributedId()
// "aB3x_V1StGXR8_Z5jdHi6B"

// Log with origin identification
console.log(`[${getFingerprint()}] Processing event ${eventId}`)

// Time-series data with sortable, strictly-monotonic IDs
const metric = {
  id: orderedId(),
  timestamp: new Date(),
  value: 42
}

// CommonJS
const { distributedId, orderedId, getFingerprint } = require('nope-id')
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
const { prefixedId, orderedId, uuid } = require('nope-id')

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
    id: orderedId(),  // Sortable, strictly-monotonic by creation time
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

nope-id has comprehensive test coverage with **342 tests** across 8 test suites, including security-specific tests.

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
| Chi-Square Distribution | ✅ χ²=44.69 | ✅ χ²=48.96 |
| Uniqueness (100K IDs) | ✅ 0 duplicates | ✅ 0 duplicates |
| Bit Distribution | ✅ 50.03/49.97% | ✅ 49.95/50.05% |
| Sequential Correlation | ✅ 0.316 avg | ✅ 0.329 avg |
| Alphabet Coverage | ✅ 64/64 (100%) | ✅ 64/64 (100%) |
| Modulo Bias (3-char) | ✅ 1.05% deviation | ✅ 1.15% deviation |

---

## Performance

> **About these numbers.** These tables are refreshed automatically by a
> [GitHub Actions workflow](.github/workflows/benchmark-on-pr.yml) on every PR
> against `main`, running on a shared `ubuntu-latest` runner. CI runners are
> typically slower than modern developer machines and production servers, so on
> real hardware nope-id often hits **higher** numbers than what you see here.
> Run `npm run benchmark` locally to see numbers on your own machine.

<!-- bench:meta:start -->
_Last refreshed: 2026-05-28, Node v22.x, darwin/arm64 (local)._
<!-- bench:meta:end -->

### nope-id vs nanoid Benchmark

**nope-id wins all 5 core benchmarks vs nanoid 5.1.11**, and ships many extra ID formats and security hardening on top.

Run the benchmark yourself:

```bash
npm run benchmark
```

**Results (Node.js 20+, nanoid 5.1.11, auto-calibrated ~120 ms × best of 7 trials, with a global warmup for fairness; absolute numbers vary by machine):**

<!-- bench:comparison-table:start -->
| Test | nanoid 5.1.11 | nope-id | Winner |
|------|--------|---------|--------|
| Basic (21 chars) | ~7.3M ops/sec | **~51.2M ops/sec** | **nope-id ~7x** |
| Small (10 chars) | ~13.3M ops/sec | **~61.4M ops/sec** | **nope-id ~4.6x** |
| Large (64 chars) | ~2.9M ops/sec | **~23.5M ops/sec** | **nope-id ~8.2x** |
| Custom Alphabet | ~7.9M ops/sec | **~31.4M ops/sec** | **nope-id ~4x** |
| Batch (100 IDs) | ~73K ops/sec | **~534K ops/sec** | **nope-id ~7.3x** |
<!-- bench:comparison-table:end -->

**Result: nope-id wins 5/5 against nanoid** for URL-safe IDs, while providing many extra features and security hardening.

### Where the speed comes from (and where it doesn't)

nope-id is the fastest **JavaScript** library for a specific, very common job: a **cryptographically secure, URL-safe id over a full 64-character alphabet** (the nanoid niche). In that category it beats nanoid by a wide margin at every standard size (see the comparison table above for exact ratios), and it also produces UUIDv7 and ULID **far faster** than the dedicated packages (see the UUID and ULID tables below).

The speed comes from the engineering, not from cutting corners on randomness:

- **Cached pool string:** the CSPRNG byte pool is translated in place to alphabet character codes on refill, then decoded **once** to a flat one-byte string (`idPool.toString('latin1')`) cached as `idPoolStr`. Each `nopeid()` call then returns a single `idPoolStr.substring(start, end)`, a V8 SlicedString (O(1), zero-copy) for sizes ≥ 13 and a tiny inline copy below that, instead of paying `Buffer.toString`'s ~50 ns fixed cost per call. Same trick powers `customAlphabet`, `uuid()`, and friends.
- **16-bit batch refill:** the in-place translation walks the pool in 16-bit chunks via a precomputed 64 KiB `Uint16Array` table that maps any two random bytes directly to two alphabet codes, halving the refill iteration count (endian-agnostic by construction).
- **Pooled CSPRNG:** one `crypto.getRandomValues()` fill covers thousands of IDs at the default size instead of one syscall per ID. `uuid()` goes further: it pre-formats 4096 v4 UUIDs (with version + RFC 4122 variant bits already patched per slot) into one 144 KiB string, so each call is just a `substring(start, start+36)`.
- **Bitmask, no modulo:** alphabet index comes from `byte & 63` on a 64-character alphabet, so there is no rejection sampling or modulo bias on the hot path.
- **Precomputed tables for everything else:** byte to hex for `uuid()`/`uuidv7()`/`objectId()`, char codes for Crockford in `ulid()`/`monotonicFactory()`, plus reusable module-scope scratch buffers (`UUID_BUF`, `SORT_BUF`, `ULID_BUF`) so the per-call path never allocates.
- **Allocation-free `customAlphabet`:** reads the shared byte pool directly, mapping rejected-sampled bytes into a pre-decoded char-code pool whose hot path is again `substring(start, end)`; this also speeds up `slugId()` and `shortId()`.

What nope-id does **not** try to beat:

- **Smaller-alphabet generators** like `uid` (16-char hex). A 21-char `uid` is ~84 bits; nope-id's 21 chars are ~126 bits, so at equal entropy nope-id is actually faster, but for short hex IDs `uid` is still a fine choice.

So nope-id's goal is to be the fastest **while preserving maximum randomness per character**, in one zero-dependency, dual-module package.

### UUID generation vs the `uuid` package and native `crypto.randomUUID()`

A benchmark is only meaningful against more than one tool (thanks to nanoid's author for the nudge in [#4](https://github.com/orhanayd/nope-id/issues/4)). Here's the honest picture for UUIDs:

<!-- bench:uuid-table:start -->
| Generator | ops/sec | |
|---|---|---|
| `crypto.randomUUID()` (Node native, v4) | **~27M** | 🥇 fastest for plain v4 |
| nope-id `uuid()` (v4) | ~22.6M | ~2.8x faster than `@lukeed/uuid`, ahead of `uuid` |
| `@lukeed/uuid` `v4()` | ~8.0M | optimized pure-JS v4 |
| `uuid` package `v4()` | ~8.1M | |
| nope-id `uuidv7()` | ~8.6M | **~8x the `uuid` package's v7** |
| `uuid` package `v7()` | ~1.0M | |
<!-- bench:uuid-table:end -->

**Honest take:** nope-id's `uuid()` pre-formats 4096 v4 UUIDs per CSPRNG refill, so each call is just a `substring()`. Result: at least on par with native `crypto.randomUUID()`, and ahead of it in current CI. The two trade places on real hardware (shared CSPRNG entropy path plus runner noise), so treat them as effectively tied for speed. If a plain v4 UUID is *all* you need and you do not want a dependency, the stdlib does the job. But if you are already using nope-id for anything else (UUIDv7, ULID, Snowflake, ObjectId, Sqids, typed IDs, nanoid-style short IDs, or just faster URL-safe IDs than nanoid), there is no reason to reach for native; `uuid()` is at least as fast, dual-module, and zero-dependency.

### ULID (sortable) vs the `ulid` package

ULIDs are an attractive alternative to UUIDs: **lexicographically sortable**, a compact **26 characters** (vs UUID's 36), Crockford base32 (URL-safe, case-insensitive), 128-bit and UUID-compatible, with a monotonic option that handles the same millisecond correctly. Unlike random UUID v4, their time prefix keeps database indexes from fragmenting.

nope-id ships a spec-compliant `ulid()` plus an isolated `monotonicFactory()`. Same 26-char format as the `ulid` package, both crypto-backed:

<!-- bench:ulid-table:start -->
| Generator | ops/sec |
|---|---|
| nope-id `ulid()` | **~3.6M** |
| `ulid` package | ~58K |
| nope-id `monotonicFactory()` | **~16.1M** |
| `ulid` package (monotonic) | ~2.3M |
<!-- bench:ulid-table:end -->

nope-id is far faster for plain `ulid()` because it draws randomness from a pooled buffer (one fill per 16 IDs), whereas the `ulid` package fetches randomness per character. Decode the timestamp from either with `decodeTime()`. (The `ulid` package is also zero-dependency.)

### Sortable head-to-head: `sparkid` vs nope-id `sortableId()`

Both are CSPRNG-backed, time-sortable + monotonic generators with similar internal architecture (pre-translated random-byte pool, lookup tables, cached prefix string). Defaults differ though: sparkid is 21-char Base58, nope-id's `sortableId()` is 22-char Crockford Base32 (22 is the safe minimum to keep the strong monotonic guarantee). So this is a natural-defaults comparison rather than a strict format-identical one.

<!-- bench:sortable-table:start -->
| Generator | ops/sec |
|---|---|
| nope-id `sortableId()` (22-char Crockford) | ~10.4M |
| `sparkid` (21-char Base58) | **~16.2M** |
<!-- bench:sortable-table:end -->

### Speed vs entropy: where each library lands

Two things matter for an id generator: **speed** and **entropy**, the amount of real randomness each id carries (its security against being guessed). These are all good libraries; the table shows the trade-off each one makes, measured at 21 characters where the length is configurable:

<!-- bench:speed-vs-entropy-table:start -->
| Generator | ops/sec | entropy / id | randomness source |
|---|---|---|---|
| **nope-id `nopeid()`** | **~51.2M** | **~126 bits (64-char URL-safe)** | **CSPRNG** |
| `uid/secure` | ~9.6M | ~84 bits (16-char hex) | CSPRNG |
| nanoid | ~7.3M | ~126 bits (64-char URL-safe) | CSPRNG |
| `sparkid` | ~16.2M | ~76 bits random (Base58, time-sortable) | CSPRNG |
| `rndm` | ~3.6M | ~125 bits, but predictable | `Math.random` (not secure) |
| `secure-random-string` | ~805K | ~126 bits (base64, not URL-safe) | CSPRNG |
| cuid2 `createId()` | ~7.7K | 24-char, hash-derived | CSPRNG + SHA-3 |
<!-- bench:speed-vs-entropy-table:end -->

Read as two axes, **speed** and **security**, every other library gives something up on one of them:

- **`uid/secure`** is fast, but pays with a smaller alphabet: ~84 bits per 21-char id against nope-id's ~126. For equal security you would have to make `uid` longer, at which point nope-id is already ahead per bit.
- **`rndm`** is fast too, but it is built on `Math.random`, so its bits are predictable; its own README calls it "not cryptographically secure."
- **`secure-random-string`** matches nope-id's entropy but is roughly 80x slower and emits base64 (not URL-safe).
- **cuid2** spends speed on purpose for a hardened, sharding-safe, hash-based model.
- **`sparkid`** is CSPRNG-backed, time-sortable + monotonic, and very fast in its niche; it spends 8 of its 21 chars on a Base58 timestamp prefix, leaving ~76 bits of unguessable randomness per id (close to ULID territory). If you want **maximum randomness per id**, nope-id's `nopeid()` keeps the full 126 bits at the same length. If you specifically want **sortable + monotonic**, sparkid holds its own (see the head-to-head above); nope-id also offers `sortableId()`, `ulid()`, and `monotonicFactory()` for ULID-compatible 26-char Crockford output.
- **nanoid** matches nope-id's entropy exactly (same 64-char alphabet); nope-id is simply <!-- bench:basic-21-ratio:start -->~7x<!-- bench:basic-21-ratio:end --> faster at the default 21-char size.

nope-id is the one row that has **all three at once**: maximum entropy per character (126 bits), a real CSPRNG, and top-tier speed. That is the whole design goal, fast without ever spending randomness to get there. (For a plain v4 UUID, native `crypto.randomUUID()` is roughly tied with nope-id's `uuid()` at 122 bits in C++; reach for the stdlib if a v4 UUID is all you need and you do not want a dependency.)

### Extra Features Performance

These features are exclusive to nope-id (nanoid doesn't have them):

<!-- bench:extras-table:start -->
| Feature | Performance |
|---------|-------------|
| `sortableId()` | ~10.4M ops/sec |
| `prefixedId()` | ~39.1M ops/sec |
| `uuid()` | ~22.7M ops/sec |
| `slugId()` | ~8.8M ops/sec |
| `shortId()` | ~19.8M ops/sec |
| `isValid()` | ~7.0M ops/sec |
| `uuidv7()` | ~8.7M ops/sec |
| `ulid()` | ~3.7M ops/sec |
| `monotonicFactory()` | ~16M ops/sec |
| `snowflake` (factory) | ~4.1M ops/sec |
| `objectId()` | ~9.6M ops/sec |
| `sqids.encode()` | ~330K ops/sec |
<!-- bench:extras-table:end -->

---

## Disclaimer

While nope-id uses cryptographically secure random number generators (`crypto.getRandomValues`) and implements security best practices, **no software can guarantee 100% randomness or absolute security**. The quality of randomness ultimately depends on the underlying operating system's entropy source.

For extremely high-security applications (e.g., cryptographic keys, long-term secrets), consider using dedicated cryptographic libraries that have undergone formal security audits.

nope-id is provided "as is" without warranty of any kind. Always evaluate whether it meets your specific security requirements.

---

## License

MIT
