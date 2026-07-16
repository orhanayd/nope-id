# nope-id

> 🌐 **Full documentation:** [English](docs/README.md) · [Türkçe](docs/README.tr.md) · [Русский](docs/README.ru.md)

A tiny, secure, URL-friendly unique string ID generator for JavaScript.

**A faster, more secure alternative to nanoid with extra features!**

<!-- bench:headline:start -->
- **Faster** - 1.4x to 3x faster than nanoid (CSPRNG, full URL-safe alphabet); wins all 5 core benchmarks ([see benchmarks](#performance))
<!-- bench:headline:end -->
- **Security Hardened** - Reduced timing-leak validators, modulo bias elimination, prototype pollution protection ([see security](docs/README.md#security))
- **Well Tested** - 408 tests including security & entropy tests ([see testing](docs/README.md#testing))
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

## More Examples

Custom alphabets ([full API reference](docs/README.md#api-reference)):

```javascript
import { customAlphabet } from 'nope-id'

const hexId = customAlphabet('0123456789abcdef', 16)
hexId()   // "4f90d13a42f17f80"
hexId(8)  // "a3b2c1d4"
```

Prefixed IDs for database entries ([more](docs/README.md#id-generation-functions)):

```javascript
import { prefixedId } from 'nope-id'

prefixedId('user')           // "user_V1StGXR8_Z5jdHi6B-myT"
prefixedId('order', 10)      // "order_IRFa-VaY2b"
prefixedId('prod', 8, '-')   // "prod-Z5jdHi6B"
```

Sortable, strictly-monotonic IDs ([more](docs/README.md#sortable-monotonic-ids)):

```javascript
import { orderedId } from 'nope-id'

orderedId()                   // "1okw67hF111114mDXU1ez" (21-char Base58, sortable)
orderedId() < orderedId()     // true (strictly increasing, clock-rewind safe)
orderedId.many(1000)          // 1000 sortable IDs, faster than a loop
orderedId.parse('1okw67hF111114mDXU1ez') // { timestamp: Date, counter, random }
```

UUID v4 & v7, ULID and more ([all formats](docs/README.md#additional-id-formats--helpers)):

```javascript
import { uuid, uuidv7, ulid, decodeTime } from 'nope-id'

uuid()              // "e2ef524f-bce6-4c4e-b7dd-2c4b3a6e1d0f" (v4)
uuidv7()            // "0192f3c1-8e2a-7b3c-9d4e-5f60718293a4" (time-ordered)
ulid()              // "01ARZ3NDEKTSV4RRFFQ69G5FAV"
decodeTime(ulid())  // Date
```

Secure bearer tokens — API keys, session tokens ([more](docs/README.md#secure-tokens-bearer-secrets)):

```javascript
import { secureToken, apiKey } from 'nope-id'

secureToken()          // 48-char URL-safe token (unpooled, raw bytes zeroized)
apiKey('sk_live', 40)  // "sk_live_<40 chars>"
```

## Documentation

The full documentation lives in [`docs/README.md`](docs/README.md) (also available in [Türkçe](docs/README.tr.md) and [Русский](docs/README.ru.md)):

- [API Reference](docs/README.md#api-reference) — core functions, generators, utilities, [pre-built alphabets](docs/README.md#pre-built-alphabets)
- [Additional ID formats](docs/README.md#additional-id-formats--helpers) — UUID v4/v7, ULID, Snowflake, MongoDB ObjectId, Sqids, typed IDs
- [Sortable, monotonic IDs](docs/README.md#sortable-monotonic-ids) — `orderedId()`
- [Secure tokens (bearer secrets)](docs/README.md#secure-tokens-bearer-secrets) — `secureToken()`, `apiKey()`, `defineToken()`
- [Choose the right ID](docs/README.md#choose-the-right-id) — decision table for common use cases
- [Security](docs/README.md#security) & [Security profiles](docs/README.md#security-profiles)
- [Non-secure version](docs/README.md#non-secure-version) — `nope-id/non-secure`
- [Real-world examples](docs/README.md#real-world-examples) — DB keys, API tokens, URL shortener, React, Express
- [Comparison with nanoid](docs/README.md#comparison-with-nanoid)
- [Browser support](docs/README.md#browser-support)
- [Testing](docs/README.md#testing)
- [Disclaimer](docs/README.md#disclaimer)

## Performance

The core head-to-head vs the latest installed nanoid (auto-refreshed by CI on every PR):

<!-- bench:meta:start -->
_Last refreshed: 2026-07-16, Node v26.x, ubuntu-latest (GitHub Actions)._
<!-- bench:meta:end -->

<!-- bench:comparison-table:start -->
| Test | nanoid 6.0.0 | nope-id | Winner |
|------|--------|---------|--------|
| Basic (21 chars) | ~27.4M ops/sec | **~58.2M ops/sec** | **nope-id ~2.1x** |
| Small (10 chars) | ~36.9M ops/sec | **~52.2M ops/sec** | **nope-id ~1.4x** |
| Large (64 chars) | ~10.8M ops/sec | **~33.8M ops/sec** | **nope-id ~3.1x** |
| Custom Alphabet | ~32.8M ops/sec | **~70M ops/sec** | **nope-id ~2.1x** |
| Batch (100 IDs) | ~269K ops/sec | **~779K ops/sec** | **nope-id ~2.9x** |
<!-- bench:comparison-table:end -->

- [Full benchmark tables and methodology](docs/README.md#performance)
- Run locally: `npm run benchmark`

## Changelog

See the [GitHub Releases page](https://github.com/orhanayd/nope-id/releases) for the detailed changelog.

## License

MIT
