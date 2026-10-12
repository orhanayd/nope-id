// CommonJS type test: 'nope-id' resolves through the package "require" condition
// (index.d.cts, non-secure/index.d.cts). Compiled by `npm run test:types` under
// both node16 and nodenext; never executed.
//
// Run with: npm run test:types

import nope = require('nope-id')
import nonSecure = require('nope-id/non-secure')
import nopeidDefault, { customAlphabet, nopeidAsync, orderedId, type CollisionInfo, type TypedId } from 'nope-id'

// === module.exports is nopeid itself: callable, with every named export attached ===
const a: string = nope()
const b: string = nope(10)
const c: string = nope.nopeid()
const d: string = nope.default()
const e: string = nopeidDefault()
const f: string = customAlphabet('abc', 5)()
const g: Promise<string> = nopeidAsync()
const h: string = orderedId()
const info: CollisionInfo = nope.collisionProbability(21)
const user: TypedId<'user'> = nope.defineId('user')
const userId: `user_${string}` = user.generate()

const ns: string = nonSecure()
const nsId: string = nonSecure.customAlphabet('ab', 4)()
const nsSlug: string = nonSecure.slugId()
// @ts-expect-error secureToken is secure-only; it must not exist on the non-secure entry
nonSecure.secureToken()

// === drift guard: the CJS declarations mirror the ESM ones exactly ===
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false
// Keys of A whose type differs in B (or that B lacks): must be `never`.
type Mismatched<A, B> = {
  [K in keyof A]: K extends keyof B ? (Equal<A[K], B[K]> extends true ? never : K) : K
}[keyof A]
// nopeid/default differ by design: the CJS value is the ESM function plus the attached exports.
type Plain<M> = Omit<M, 'default' | 'nopeid'>

type Esm = typeof import('nope-id', { with: { 'resolution-mode': 'import' } })
type EsmNonSecure = typeof import('nope-id/non-secure', { with: { 'resolution-mode': 'import' } })

const sameKeys: Equal<keyof Esm, keyof typeof nope> = true
const sameValues: [Mismatched<Plain<Esm>, Plain<typeof nope>>] extends [never] ? true : false = true
const sameNsKeys: Equal<keyof EsmNonSecure, keyof typeof nonSecure> = true
const sameNsValues: [Mismatched<Plain<EsmNonSecure>, Plain<typeof nonSecure>>] extends [never] ? true : false = true
const callable: Esm['nopeid'] = nope.nopeid
const callableDefault: Esm['default'] = nope.default
const nsCallable: EsmNonSecure['nopeid'] = nonSecure.nopeid

type EsmType<K extends string> = K extends keyof EsmTypes ? EsmTypes[K] : never
interface EsmTypes {
  CollisionInfo: import('nope-id', { with: { 'resolution-mode': 'import' } }).CollisionInfo
  SnowflakeOptions: import('nope-id', { with: { 'resolution-mode': 'import' } }).SnowflakeOptions
  SnowflakeParts: import('nope-id', { with: { 'resolution-mode': 'import' } }).SnowflakeParts
  SqidsOptions: import('nope-id', { with: { 'resolution-mode': 'import' } }).SqidsOptions
  Sqids: import('nope-id', { with: { 'resolution-mode': 'import' } }).Sqids
  DefineIdOptions: import('nope-id', { with: { 'resolution-mode': 'import' } }).DefineIdOptions
  TypedId: import('nope-id', { with: { 'resolution-mode': 'import' } }).TypedId<'x'>
  DefineTokenOptions: import('nope-id', { with: { 'resolution-mode': 'import' } }).DefineTokenOptions
  TypedToken: import('nope-id', { with: { 'resolution-mode': 'import' } }).TypedToken<'x'>
  OrderedIdParts: import('nope-id', { with: { 'resolution-mode': 'import' } }).OrderedIdParts
  OrderedId: import('nope-id', { with: { 'resolution-mode': 'import' } }).OrderedId
}
const sameTypes: [
  Equal<nope.CollisionInfo, EsmType<'CollisionInfo'>>,
  Equal<nope.SnowflakeOptions, EsmType<'SnowflakeOptions'>>,
  Equal<nope.SnowflakeParts, EsmType<'SnowflakeParts'>>,
  Equal<nope.SqidsOptions, EsmType<'SqidsOptions'>>,
  Equal<nope.Sqids, EsmType<'Sqids'>>,
  Equal<nope.DefineIdOptions, EsmType<'DefineIdOptions'>>,
  Equal<nope.TypedId<'x'>, EsmType<'TypedId'>>,
  Equal<nope.DefineTokenOptions, EsmType<'DefineTokenOptions'>>,
  Equal<nope.TypedToken<'x'>, EsmType<'TypedToken'>>,
  Equal<nope.OrderedIdParts, EsmType<'OrderedIdParts'>>,
  Equal<nope.OrderedId, EsmType<'OrderedId'>>,
] = [true, true, true, true, true, true, true, true, true, true, true]

export {
  a, b, c, d, e, f, g, h, info, userId, ns, nsId, nsSlug,
  sameKeys, sameValues, sameNsKeys, sameNsValues, callable, callableDefault, nsCallable, sameTypes,
}
