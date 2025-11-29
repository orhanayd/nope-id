// Randomness Comparison Test - nope-id vs nanoid
// Tests entropy quality, distribution uniformity, and statistical randomness

import { nopeid, customAlphabet, random } from '../index.js'
import { nanoid, customAlphabet as nanoidCustomAlphabet } from 'nanoid'

const SAMPLE_SIZE = 100000
const ID_LENGTH = 21

console.log('╔══════════════════════════════════════════════════════════════════════╗')
console.log('║          RANDOMNESS COMPARISON TEST - nope-id vs nanoid             ║')
console.log('╠══════════════════════════════════════════════════════════════════════╣')
console.log(`║  Sample Size: ${SAMPLE_SIZE.toLocaleString()} IDs | ID Length: ${ID_LENGTH} characters`)
console.log('╚══════════════════════════════════════════════════════════════════════╝\n')

// URL-safe alphabet (same for both)
const URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

// ============================================
// TEST 1: Character Distribution (Chi-Square)
// ============================================
function chiSquareTest(name, generator, iterations, idLength) {
  const observed = new Array(64).fill(0)
  const totalChars = iterations * idLength

  for (let i = 0; i < iterations; i++) {
    const id = generator()
    for (const char of id) {
      const idx = URL_ALPHABET.indexOf(char)
      if (idx !== -1) observed[idx]++
    }
  }

  const expected = totalChars / 64
  let chiSquare = 0
  for (let i = 0; i < 64; i++) {
    chiSquare += Math.pow(observed[i] - expected, 2) / expected
  }

  // Chi-square critical value for 63 df at 0.05 significance: ~82
  // At 0.01 significance: ~92
  const passed = chiSquare < 100

  return { chiSquare, expected, passed, observed }
}

// ============================================
// TEST 2: Uniqueness Test
// ============================================
function uniquenessTest(name, generator, iterations) {
  const ids = new Set()
  let duplicates = 0

  for (let i = 0; i < iterations; i++) {
    const id = generator()
    if (ids.has(id)) {
      duplicates++
    }
    ids.add(id)
  }

  const uniqueRatio = ids.size / iterations
  const passed = duplicates === 0

  return { total: iterations, unique: ids.size, duplicates, uniqueRatio, passed }
}

// ============================================
// TEST 3: Bit Distribution (for random bytes)
// ============================================
function bitDistributionTest(name, randomFn, byteCount) {
  const bitCounts = [0, 0] // [zeros, ones]

  for (let i = 0; i < 100; i++) {
    const bytes = randomFn(byteCount)
    for (let j = 0; j < bytes.length; j++) {
      for (let bit = 0; bit < 8; bit++) {
        bitCounts[(bytes[j] >> bit) & 1]++
      }
    }
  }

  const totalBits = 100 * byteCount * 8
  const expectedPerBit = totalBits / 2
  const zeroRatio = bitCounts[0] / totalBits
  const oneRatio = bitCounts[1] / totalBits

  // Should be close to 50/50
  const deviation = Math.abs(0.5 - zeroRatio)
  const passed = deviation < 0.02 // Within 2%

  return { zeros: bitCounts[0], ones: bitCounts[1], zeroRatio, oneRatio, deviation, passed }
}

// ============================================
// TEST 4: Sequential Correlation Test
// ============================================
function correlationTest(name, generator, iterations) {
  let totalSamePositions = 0
  let comparisons = 0
  let prevId = generator()

  for (let i = 1; i < iterations; i++) {
    const currId = generator()
    let samePos = 0
    for (let j = 0; j < currId.length; j++) {
      if (currId[j] === prevId[j]) samePos++
    }
    totalSamePositions += samePos
    comparisons++
    prevId = currId
  }

  const avgSamePositions = totalSamePositions / comparisons
  // Expected: 21 chars / 64 alphabet = ~0.33 same positions by chance
  const expectedSame = ID_LENGTH / 64
  const passed = avgSamePositions < expectedSame * 2 // Should be close to expected

  return { avgSamePositions, expectedSame, comparisons, passed }
}

// ============================================
// TEST 5: Alphabet Coverage Test
// ============================================
function alphabetCoverageTest(name, generator, iterations) {
  const usedChars = new Set()

  for (let i = 0; i < iterations; i++) {
    const id = generator()
    for (const char of id) {
      usedChars.add(char)
    }
  }

  const coverage = usedChars.size / 64
  const passed = usedChars.size === 64 // Should use all 64 characters

  return { usedChars: usedChars.size, totalAlphabet: 64, coverage, passed }
}

// ============================================
// TEST 6: Modulo Bias Test (3-char alphabet)
// ============================================
function moduloBiasTest(name, customAlphabetFn) {
  // 3-char alphabet is worst case for bias (256 % 3 = 1)
  const gen = customAlphabetFn('ABC', 1)
  const counts = { A: 0, B: 0, C: 0 }
  const iterations = 30000

  for (let i = 0; i < iterations; i++) {
    counts[gen()]++
  }

  const expected = iterations / 3
  const maxDeviation = Math.max(
    Math.abs(counts.A - expected) / expected,
    Math.abs(counts.B - expected) / expected,
    Math.abs(counts.C - expected) / expected
  )

  // Should be within 5% of expected
  const passed = maxDeviation < 0.05

  return { counts, expected, maxDeviation, passed }
}

// ============================================
// RUN ALL TESTS
// ============================================

function runTest(testName, nopeidResult, nanoidResult) {
  console.log(`\n📊 ${testName}`)
  console.log('─'.repeat(70))

  const formatResult = (name, result) => {
    const status = result.passed ? '✅' : '❌'
    return { name, status, ...result }
  }

  const nope = formatResult('nope-id', nopeidResult)
  const nano = formatResult('nanoid', nanoidResult)

  return { testName, nopeid: nope, nanoid: nano }
}

const results = []

// Test 1: Chi-Square
console.log('\n🔬 Running Chi-Square Distribution Test...')
const chiNopeid = chiSquareTest('nope-id', () => nopeid(ID_LENGTH), SAMPLE_SIZE, ID_LENGTH)
const chiNanoid = chiSquareTest('nanoid', () => nanoid(ID_LENGTH), SAMPLE_SIZE, ID_LENGTH)
results.push(runTest('Chi-Square Distribution Test', chiNopeid, chiNanoid))
console.log(`   nope-id: χ² = ${chiNopeid.chiSquare.toFixed(2)} ${chiNopeid.passed ? '✅' : '❌'}`)
console.log(`   nanoid:  χ² = ${chiNanoid.chiSquare.toFixed(2)} ${chiNanoid.passed ? '✅' : '❌'}`)
console.log(`   (Lower is better, should be < 100 for 63 degrees of freedom)`)

// Test 2: Uniqueness
console.log('\n🔬 Running Uniqueness Test...')
const uniqNopeid = uniquenessTest('nope-id', () => nopeid(ID_LENGTH), SAMPLE_SIZE)
const uniqNanoid = uniquenessTest('nanoid', () => nanoid(ID_LENGTH), SAMPLE_SIZE)
results.push(runTest('Uniqueness Test', uniqNopeid, uniqNanoid))
console.log(`   nope-id: ${uniqNopeid.unique.toLocaleString()}/${uniqNopeid.total.toLocaleString()} unique (${uniqNopeid.duplicates} duplicates) ${uniqNopeid.passed ? '✅' : '❌'}`)
console.log(`   nanoid:  ${uniqNanoid.unique.toLocaleString()}/${uniqNanoid.total.toLocaleString()} unique (${uniqNanoid.duplicates} duplicates) ${uniqNanoid.passed ? '✅' : '❌'}`)

// Test 3: Bit Distribution
console.log('\n🔬 Running Bit Distribution Test...')
const bitNopeid = bitDistributionTest('nope-id', random, 1000)
// nanoid doesn't export random, so we skip or use crypto directly
const bitNanoid = bitDistributionTest('nanoid (crypto)', (n) => {
  const arr = new Uint8Array(n)
  crypto.getRandomValues(arr)
  return arr
}, 1000)
results.push(runTest('Bit Distribution Test', bitNopeid, bitNanoid))
console.log(`   nope-id: ${(bitNopeid.zeroRatio * 100).toFixed(2)}% zeros / ${(bitNopeid.oneRatio * 100).toFixed(2)}% ones ${bitNopeid.passed ? '✅' : '❌'}`)
console.log(`   nanoid:  ${(bitNanoid.zeroRatio * 100).toFixed(2)}% zeros / ${(bitNanoid.oneRatio * 100).toFixed(2)}% ones ${bitNanoid.passed ? '✅' : '❌'}`)
console.log(`   (Should be close to 50/50)`)

// Test 4: Sequential Correlation
console.log('\n🔬 Running Sequential Correlation Test...')
const corrNopeid = correlationTest('nope-id', () => nopeid(ID_LENGTH), 10000)
const corrNanoid = correlationTest('nanoid', () => nanoid(ID_LENGTH), 10000)
results.push(runTest('Sequential Correlation Test', corrNopeid, corrNanoid))
console.log(`   nope-id: avg ${corrNopeid.avgSamePositions.toFixed(3)} same positions ${corrNopeid.passed ? '✅' : '❌'}`)
console.log(`   nanoid:  avg ${corrNanoid.avgSamePositions.toFixed(3)} same positions ${corrNanoid.passed ? '✅' : '❌'}`)
console.log(`   (Expected by chance: ~${corrNopeid.expectedSame.toFixed(3)})`)

// Test 5: Alphabet Coverage
console.log('\n🔬 Running Alphabet Coverage Test...')
const covNopeid = alphabetCoverageTest('nope-id', () => nopeid(ID_LENGTH), 10000)
const covNanoid = alphabetCoverageTest('nanoid', () => nanoid(ID_LENGTH), 10000)
results.push(runTest('Alphabet Coverage Test', covNopeid, covNanoid))
console.log(`   nope-id: ${covNopeid.usedChars}/64 characters used (${(covNopeid.coverage * 100).toFixed(1)}%) ${covNopeid.passed ? '✅' : '❌'}`)
console.log(`   nanoid:  ${covNanoid.usedChars}/64 characters used (${(covNanoid.coverage * 100).toFixed(1)}%) ${covNanoid.passed ? '✅' : '❌'}`)

// Test 6: Modulo Bias
console.log('\n🔬 Running Modulo Bias Test (3-char alphabet)...')
const biasNopeid = moduloBiasTest('nope-id', customAlphabet)
const biasNanoid = moduloBiasTest('nanoid', nanoidCustomAlphabet)
results.push(runTest('Modulo Bias Test', biasNopeid, biasNanoid))
console.log(`   nope-id: A=${biasNopeid.counts.A}, B=${biasNopeid.counts.B}, C=${biasNopeid.counts.C} (max deviation: ${(biasNopeid.maxDeviation * 100).toFixed(2)}%) ${biasNopeid.passed ? '✅' : '❌'}`)
console.log(`   nanoid:  A=${biasNanoid.counts.A}, B=${biasNanoid.counts.B}, C=${biasNanoid.counts.C} (max deviation: ${(biasNanoid.maxDeviation * 100).toFixed(2)}%) ${biasNanoid.passed ? '✅' : '❌'}`)
console.log(`   (Should be within 5% of ${Math.round(30000/3)} each)`)

// ============================================
// SUMMARY
// ============================================
console.log('\n')
console.log('╔══════════════════════════════════════════════════════════════════════╗')
console.log('║                           SUMMARY                                    ║')
console.log('╠══════════════════════════════════════════════════════════════════════╣')

let nopeidPassed = 0
let nanoidPassed = 0

results.forEach(r => {
  if (r.nopeid.passed) nopeidPassed++
  if (r.nanoid.passed) nanoidPassed++
})

console.log(`║  nope-id: ${nopeidPassed}/${results.length} tests passed                                          ║`)
console.log(`║  nanoid:  ${nanoidPassed}/${results.length} tests passed                                          ║`)
console.log('╠══════════════════════════════════════════════════════════════════════╣')

const table = [
  ['Test', 'nope-id', 'nanoid'],
  ['─'.repeat(30), '─'.repeat(10), '─'.repeat(10)],
]

results.forEach(r => {
  table.push([
    r.testName.substring(0, 30),
    r.nopeid.passed ? '✅ PASS' : '❌ FAIL',
    r.nanoid.passed ? '✅ PASS' : '❌ FAIL'
  ])
})

table.forEach(row => {
  console.log(`║  ${row[0].padEnd(32)} ${row[1].padEnd(12)} ${row[2].padEnd(12)}  ║`)
})

console.log('╚══════════════════════════════════════════════════════════════════════╝')

// Final verdict
console.log('\n')
if (nopeidPassed >= nanoidPassed) {
  console.log('🏆 Result: nope-id randomness quality is equal or better than nanoid!')
} else {
  console.log('⚠️  Result: Some tests need attention.')
}
console.log('\n')
