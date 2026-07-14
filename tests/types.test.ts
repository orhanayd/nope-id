// Type-only test: imports the public API and exercises each declared signature.
// Compiled by `tsc --noEmit`, so it fails CI if index.d.ts drifts from the runtime
// shape. Runtime is irrelevant; the file is never executed.
//
// Run with: npm run test:types

import nopeidDefault, {
  alphabets,
  apiKey,
  collisionProbability,
  customAlphabet,
  customRandom,
  decodeObjectIdTime,
  decodeSnowflake,
  decodeTime,
  defineId,
  defineToken,
  distributedId,
  generateMany,
  getFingerprint,
  isValid,
  isValidUUID,
  isValidULID,
  monotonicFactory,
  nopeid,
  nopeidAsync,
  objectId,
  orderedId,
  prefixedId,
  random,
  secureToken,
  shortId,
  slugId,
  snowflake,
  snowflakeFactory,
  sortableId,
  sqidsFactory,
  ulid,
  urlAlphabet,
  uuid,
  uuidv7,
  type CollisionInfo,
  type DefineIdOptions,
  type DefineTokenOptions,
  type OrderedIdParts,
  type Sqids,
  type SqidsOptions,
  type SnowflakeOptions,
  type SnowflakeParts,
  type TypedId,
  type TypedToken,
} from '../index.js'

// === Core ===
const defaultId: string = nopeidDefault()
const id1: string = nopeid()
const id2: string = nopeid(10)
const empty: string = nopeid(0)

const hexGen: (size?: number) => string = customAlphabet('0123456789abcdef', 16)
const hexId: string = hexGen()
const hexId8: string = hexGen(8)

const customGen: (size?: number) => string = customRandom(
  'abc',
  10,
  (n: number): Uint8Array => new Uint8Array(n)
)
const customId: string = customGen()

const bytes: Uint8Array = random(16)

const alpha: string = urlAlphabet
const alphaNum: string = alphabets.alphanumeric
const filename: string = alphabets.filename

// === Variants ===
const sortable: string = sortableId()
const sortable30: string = sortableId(30)
const t: Date = decodeTime(sortable)

const userPrefixed: string = prefixedId('user')
const ordPrefixed: string = prefixedId('order', 10, '-')

const many: string[] = generateMany(5)
const manyShort: string[] = generateMany(100, 8)

const validity: boolean = isValid(id1)
const validity2: boolean = isValid(id1, urlAlphabet)

const stats: CollisionInfo = collisionProbability(21)
const stats64: CollisionInfo = collisionProbability(21, 64)
const safe: number = stats.safeCount
const safeBig: bigint = stats.totalPossibleBigInt
const yrs: number = stats.yearsFor1Percent

const asyncId: Promise<string> = nopeidAsync()
const asyncId10: Promise<string> = nopeidAsync(10)

// === New ID formats ===
const v4: string = uuid()
const v7: string = uuidv7()
const ul: string = ulid()
const ulSeeded: string = ulid(Date.now())

const mono: (seedTime?: number) => string = monotonicFactory()
const monoId: string = mono()
const monoSeeded: string = mono(Date.now())

const snowOpts: SnowflakeOptions = { nodeId: 1, epoch: 1288834974657 }
const snowGen: () => string = snowflakeFactory(snowOpts)
const snowId: string = snowGen()
const snowDefault: string = snowflake()
const snowParts: SnowflakeParts = decodeSnowflake(snowId)
const snowDate: Date = snowParts.timestamp
const snowSeq: number = snowParts.sequence

const oid: string = objectId()
const oidTime: Date = decodeObjectIdTime(oid)

const ord: string = orderedId()
const ordBatch: string[] = orderedId.many(1000)
const ordBytes: Uint8Array = orderedId.asciiBytes()
const ordParts: OrderedIdParts = orderedId.parse(ord)
const ordTs: Date = ordParts.timestamp
const ordCtr: number = ordParts.counter
const ordRnd: string = ordParts.random

const sqidsOpts: SqidsOptions = { alphabet: 'abcdefghij', minLength: 6, blocklist: ['nope'] }
const sq: Sqids = sqidsFactory(sqidsOpts)
const sqEnc: string = sq.encode([1, 2, 3])
const sqDec: number[] = sq.decode(sqEnc)

// === Typed prefixed IDs ===
const defOpts: DefineIdOptions = { size: 20, separator: '_', alphabet: urlAlphabet }
const userId: TypedId<'user'> = defineId('user', defOpts)
const newUser: `user_${string}` = userId.generate()
const isUser: boolean = userId.is('user_abc123')
const parsed = userId.parse(newUser)
if (parsed) {
  const prefix: 'user' = parsed.prefix
  const tail: string = parsed.id
  void prefix
  void tail
}

// === Secure bearer tokens ===
const token: string = secureToken()
const token64: string = secureToken(64)
const key: string = apiKey()
const keyCustom: string = apiKey('sk_live', 40)
const tokenOpts: DefineTokenOptions = { size: 40, separator: '_' }
const SessionToken: TypedToken<'sess'> = defineToken('sess', tokenOpts)
const newSession: `sess_${string}` = SessionToken.generate()
const isSession: boolean = SessionToken.is(newSession)
const parsedSession = SessionToken.parse(newSession)
if (parsedSession) {
  const sessPrefix: 'sess' = parsedSession.prefix
  const sessBody: string = parsedSession.token
  void sessPrefix
  void sessBody
}

// === decodeSnowflake input union (string | number | bigint) ===
const snowFromBigInt: SnowflakeParts = decodeSnowflake(123n)
const snowFromNumber: SnowflakeParts = decodeSnowflake(123)

// === Validators ===
const okUuid: boolean = isValidUUID(v4)
const okUuidV7: boolean = isValidUUID(v7, 7)
const okUlid: boolean = isValidULID(ul)

// === Other helpers ===
const slug: string = slugId()
const short: string = shortId()
const dist: string = distributedId()
const dist30: string = distributedId(30)
const fp: string = getFingerprint()

// === nope-id/non-secure surface (resolved via non-secure/index.d.ts) ===
// The 11 real exports must compile; the secure-only names must NOT resolve.
import nsDefault, {
  urlAlphabet as nsUrlAlphabet,
  alphabets as nsAlphabets,
  customAlphabet as nsCustomAlphabet,
  nopeid as nsNopeid,
  sortableId as nsSortableId,
  prefixedId as nsPrefixedId,
  generateMany as nsGenerateMany,
  isValid as nsIsValid,
  slugId as nsSlugId,
  shortId as nsShortId,
  decodeTime as nsDecodeTime,
} from '../non-secure/index.js'
// @ts-expect-error secureToken is secure-only; it must not exist on the non-secure entry
import { secureToken as nsPhantomToken } from '../non-secure/index.js'
// @ts-expect-error ulid is secure-only; it must not exist on the non-secure entry
import { ulid as nsPhantomUlid } from '../non-secure/index.js'

const nsId: string = nsNopeid()
const nsDefaultId: string = nsDefault()
const nsHex: string = nsCustomAlphabet(nsAlphabets.hexLower, 8)()
const nsSorted: Date = nsDecodeTime(nsSortableId())

// Discard everything to silence "declared but never read" warnings.
void [
  defaultId, id1, id2, empty, hexId, hexId8, customId, bytes, alpha, alphaNum, filename,
  sortable, sortable30, t, userPrefixed, ordPrefixed, many, manyShort, validity, validity2,
  stats64, safe, safeBig, yrs, asyncId, asyncId10, v4, v7, ul, ulSeeded, monoId, monoSeeded,
  snowId, snowDefault, snowDate, snowSeq, oid, oidTime, ord, ordBatch, ordBytes, ordTs, ordCtr, ordRnd, sqEnc, sqDec, newUser, isUser,
  token, token64, key, keyCustom, newSession, isSession, snowFromBigInt, snowFromNumber,
  okUuid, okUuidV7, okUlid, slug, short, dist, dist30, fp,
  nsUrlAlphabet, nsPrefixedId, nsGenerateMany, nsIsValid, nsSlugId, nsShortId,
  nsId, nsDefaultId, nsHex, nsSorted,
]
