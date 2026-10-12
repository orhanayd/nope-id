/**
 * nope-id/non-secure - CommonJS declarations for require('nope-id/non-secure').
 * Same callable `export =` shape as ../index.d.cts, narrowed to the 11 names the
 * Math.random() build ships (mirrors non-secure/index.d.ts). The randomness source
 * here is Math.random(), NOT a CSPRNG.
 */
import nope = require('../index.cjs')

/**
 * Generate a non-secure unique ID (Math.random(); never use it for secrets)
 * @param size - ID length (default: 21)
 * @returns Generated ID string (empty string if size <= 0)
 */
declare function nopeid(size?: number): string

declare namespace nopeid {
  export import urlAlphabet = nope.urlAlphabet
  export import alphabets = nope.alphabets
  export import customAlphabet = nope.customAlphabet
  export import sortableId = nope.sortableId
  export import prefixedId = nope.prefixedId
  export import generateMany = nope.generateMany
  export import isValid = nope.isValid
  export import slugId = nope.slugId
  export import shortId = nope.shortId
  export import decodeTime = nope.decodeTime

  export { nopeid as default, nopeid }
}

export = nopeid
