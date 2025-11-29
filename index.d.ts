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
  /** Total possible unique IDs with given length and alphabet */
  totalPossible: number
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

export default nopeid
