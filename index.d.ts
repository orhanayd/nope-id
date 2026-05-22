/**
 * nope-id - Secure, fast, and collision-resistant unique ID generator
 */

/**
 * URL-safe alphabet for ID generation (64 characters)
 */
export const urlAlphabet: string

/**
 * Pre-built alphabets for different use cases
 */
export const alphabets: {
  /** 0-9, A-Z, a-z (62 characters) */
  alphanumeric: string
  /** a-z (26 characters) */
  lowercase: string
  /** A-Z (26 characters) */
  uppercase: string
  /** 0-9 (10 characters) */
  numbers: string
  /** 0-9, a-f (16 characters) */
  hexLower: string
  /** 0-9, A-F (16 characters) */
  hexUpper: string
  /** Similar looking characters removed (49 characters) */
  nolookalikes: string
  /** Even safer version with more removals (34 characters) */
  nolookalikesSafe: string
  /** 0-1 (2 characters) */
  binary: string
  /** 0-7 (8 characters) */
  octal: string
  /** RFC 4648 Base32 (32 characters) */
  base32: string
  /** Lowercase Base32 (32 characters) */
  base32Lower: string
  /** Bitcoin Base58 (58 characters) */
  base58: string
  /** Filename safe characters (64 characters) */
  filename: string
}

/**
 * Generate cryptographically secure random bytes
 * @param bytes - Number of bytes to generate
 * @returns Uint8Array or Buffer with random bytes
 */
export function random(bytes: number): Uint8Array

/**
 * Create a custom ID generator with specific alphabet
 * @param alphabet - Custom alphabet string (1-256 characters)
 * @param defaultSize - Default ID size (default: 21)
 * @returns Function that generates IDs
 * @throws Error if alphabet is empty or longer than 256 characters
 */
export function customAlphabet(
  alphabet: string,
  defaultSize?: number
): (size?: number) => string

/**
 * Create a custom ID generator with custom random function
 * @param alphabet - Custom alphabet string
 * @param defaultSize - Default ID size
 * @param getRandom - Custom random function
 * @returns Function that generates IDs
 * @throws Error if alphabet is empty
 */
export function customRandom(
  alphabet: string,
  defaultSize: number,
  getRandom: (bytes: number) => Uint8Array
): (size?: number) => string

/**
 * Generate a secure unique ID
 * @param size - ID length (default: 21)
 * @returns Generated ID string (empty string if size <= 0)
 */
export function nopeid(size?: number): string

/**
 * Generate an ID with a prefix
 * @param prefix - Prefix string (e.g., 'user', 'order')
 * @param size - Random part length (default: 21)
 * @param separator - Separator between prefix and ID (default: '_')
 * @returns Prefixed ID string (e.g., 'user_abc123xyz')
 * @throws Error if prefix is not a string
 */
export function prefixedId(
  prefix: string,
  size?: number,
  separator?: string
): string

/**
 * Generate a ULID-like sortable ID with monotonic guarantee
 * Uses Crockford's Base32 for lexicographic sorting
 * Format: 10 chars timestamp + 12 chars random = 22 chars default
 * Same-millisecond IDs are guaranteed to be monotonically increasing
 * Sizes > 22 are padded with extra Crockford Base32 random chars; sizes < 22 are
 * truncated to the timestamp prefix, which weakens the same-millisecond monotonic /
 * uniqueness guarantee — use size >= 22 when you rely on monotonicity.
 * @param size - Total ID length (default: 22)
 * @returns Sortable ID string (chronologically sortable)
 */
export function sortableId(size?: number): string

/**
 * Generate multiple IDs at once
 * @param count - Number of IDs to generate
 * @param size - ID length (default: 21)
 * @returns Array of ID strings (empty array if count <= 0)
 */
export function generateMany(count: number, size?: number): string[]

/**
 * Validate if a string is a valid ID for given alphabet
 * @param id - String to validate
 * @param alphabet - Alphabet to check against (default: urlAlphabet)
 * @returns true if valid, false otherwise
 */
export function isValid(id: string, alphabet?: string): boolean

/**
 * Collision probability information
 */
export interface CollisionInfo {
  /** Total possible unique IDs, clamped to Number.MAX_SAFE_INTEGER (use totalPossibleBigInt for the exact value) */
  totalPossible: number
  /** Exact total possible unique IDs as a BigInt (alphabetSize ** idLength) */
  totalPossibleBigInt: bigint
  /** Probability of collision when generating 1 billion IDs */
  probabilityForBillion: number
  /** Number of IDs that can be safely generated (50% collision probability) */
  safeCount: number
  /** Years to generate 1 ID/ms before 1% collision probability */
  yearsFor1Percent: number
}

/**
 * Calculate collision probability for given ID parameters
 * @param idLength - Length of the ID
 * @param alphabetSize - Size of the alphabet (default: 64)
 * @returns Collision probability information
 * @throws Error if idLength or alphabetSize <= 0
 */
export function collisionProbability(
  idLength: number,
  alphabetSize?: number
): CollisionInfo

/**
 * Async version of nopeid for large batch operations
 * @param size - ID length (default: 21)
 * @returns Promise resolving to ID string
 */
export function nopeidAsync(size?: number): Promise<string>

/**
 * Generate a UUID v4 compatible string
 * @returns UUID v4 formatted string (e.g., 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx')
 */
export function uuid(): string

/**
 * Generate a slug-friendly ID (lowercase + numbers only)
 * @param size - ID length (default: 12)
 * @returns Slug-safe ID string
 */
export function slugId(size?: number): string

/**
 * Generate a short ID with no similar-looking characters
 * Good for user-facing codes like verification codes
 * @param size - ID length (default: 8)
 * @returns Short ID string
 */
export function shortId(size?: number): string

/**
 * Decode timestamp from a sortable ID
 * @param sortableIdStr - Sortable ID string (at least 10 characters)
 * @returns Date object representing the timestamp
 * @throws Error if ID is invalid or too short
 */
export function decodeTime(sortableIdStr: string): Date

/**
 * Get a unique fingerprint for the current process/device
 * Generated once per process and cached
 * @returns 4-character fingerprint string
 */
export function getFingerprint(): string

/**
 * Generate a distributed-safe ID with process fingerprint
 * Format: fingerprint_randomPart
 * @param size - Total ID length (default: 25)
 * @returns Distributed-safe ID string
 */
export function distributedId(size?: number): string

/**
 * Generate a UUID v7 (RFC 9562) - time-ordered, index-friendly.
 * 48-bit Unix ms timestamp + version + variant + 74 random bits.
 * @returns UUID v7 string (e.g. '0192f3a1-...-7...-...')
 */
export function uuidv7(): string

/**
 * Generate a spec-compliant 26-char ULID (Crockford Base32).
 * 10 chars timestamp + 16 chars randomness. Non-monotonic per call;
 * use monotonicFactory() for guaranteed same-millisecond ordering.
 * @param seedTime - Optional timestamp in ms (default: Date.now())
 * @returns 26-character ULID string (decode the time with decodeTime())
 */
export function ulid(seedTime?: number): string

/**
 * Create a monotonic ULID generator with isolated state.
 * Same/backwards-millisecond calls increment the random part so output is
 * strictly increasing. Does not touch the global sortableId() state.
 * @returns A function that generates monotonic 26-char ULIDs
 */
export function monotonicFactory(): (seedTime?: number) => string

/** Options for {@link snowflakeFactory} */
export interface SnowflakeOptions {
  /** 10-bit node/machine id (0-1023, default 0) */
  nodeId?: number
  /** Custom epoch in ms (default: Twitter epoch 1288834974657) */
  epoch?: number | bigint
}

/** Decoded Snowflake components */
export interface SnowflakeParts {
  timestamp: Date
  nodeId: number
  sequence: number
}

/**
 * Create a Snowflake ID generator (distributed 64-bit id, returned as a string).
 * Layout: 41-bit timestamp | 10-bit nodeId | 12-bit sequence.
 * Each factory owns its own sequence/timestamp state (coordination-free per node).
 * @returns A function that returns the next snowflake id as a string
 */
export function snowflakeFactory(options?: SnowflakeOptions): () => string

/**
 * Default single-node Snowflake generator (node id derived from the process fingerprint).
 * @returns Snowflake id as a string
 */
export function snowflake(): string

/**
 * Decode a snowflake id string into its components.
 * @param id - Snowflake id string
 * @param epoch - Epoch used at generation (default: Twitter epoch)
 */
export function decodeSnowflake(id: string, epoch?: number | bigint): SnowflakeParts

/**
 * Generate a MongoDB ObjectId-compatible 24-char hex id.
 * 4-byte timestamp + 5-byte per-process value + 3-byte incrementing counter.
 * @returns 24-character lowercase hex string
 */
export function objectId(): string

/**
 * Extract the creation Date from an ObjectId (first 4 bytes = seconds since epoch).
 * @param id - ObjectId hex string (at least 8 characters)
 * @throws Error if id is too short
 */
export function decodeObjectIdTime(id: string): Date

/** Options for {@link sqidsFactory} */
export interface SqidsOptions {
  /** Custom alphabet (>= 3 unique characters) */
  alphabet?: string
  /** Minimum output length (default 0) */
  minLength?: number
  /** Words to avoid in generated ids (default: none) */
  blocklist?: string[]
}

/** Sqids encoder/decoder pair */
export interface Sqids {
  /** Encode an array of non-negative integers into a short reversible string */
  encode(numbers: number[]): string
  /** Decode a string back into the original array of integers */
  decode(id: string): number[]
}

/**
 * Create a Sqids encoder/decoder for reversible integer <-> short-string mapping.
 * Obfuscation only - NOT encryption.
 */
export function sqidsFactory(options?: SqidsOptions): Sqids

/** Options for {@link defineId} */
export interface DefineIdOptions {
  /** Random part length (default 21) */
  size?: number
  /** Separator between prefix and random part (default '_') */
  separator?: string
  /** Alphabet for the random part (default urlAlphabet) */
  alphabet?: string
}

/** A typed prefixed-id helper returned by {@link defineId} (assumes the default '_' separator for its type) */
export interface TypedId<P extends string> {
  /** Generate a new prefixed id of the form `${P}_${string}` */
  generate(): `${P}_${string}`
  /** Type guard: narrows value to `${P}_${string}` when true */
  is(value: unknown): value is `${P}_${string}`
  /** Parse into { prefix, id } or null if it does not match */
  parse(value: string): { prefix: P; id: string } | null
}

/**
 * Define a typed prefixed-id helper (Stripe-style), e.g. `defineId('user')`.
 * The template-literal return type gives compile-time safety on generated ids.
 * @param prefix - The id prefix (e.g. 'user', 'order')
 */
export function defineId<P extends string>(prefix: P, options?: DefineIdOptions): TypedId<P>

/**
 * Validate a UUID string (any version 1-8 by default).
 * @param id - String to validate
 * @param version - Optional specific version (1-8) to require
 */
export function isValidUUID(id: string, version?: number): boolean

/**
 * Validate a 26-character Crockford Base32 ULID.
 * @param id - String to validate
 */
export function isValidULID(id: string): boolean

export default nopeid
