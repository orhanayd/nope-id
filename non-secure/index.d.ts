/**
 * nope-id/non-secure — Math.random()-based build for non-security-sensitive
 * IDs. Ships ONLY the 11 exports below; the secure-only formats (uuid, uuidv7,
 * ulid, orderedId, secureToken, snowflake, objectId, sqids, defineId, ...)
 * exist only in the main 'nope-id' entry. Signatures match the main entry,
 * but the randomness source here is Math.random(), NOT a CSPRNG.
 */
export {
  urlAlphabet,
  alphabets,
  customAlphabet,
  nopeid,
  sortableId,
  prefixedId,
  generateMany,
  isValid,
  slugId,
  shortId,
  decodeTime,
  default,
} from '../index.js'
