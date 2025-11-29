#!/usr/bin/env node
// Main test runner - runs all test suites

import { resetResults } from './test-utils.js'

console.log('🧪 nope-id Test Suite')
console.log('='.repeat(50))

// Track overall results
let totalPassed = 0
let totalFailed = 0

const runSuite = async (name, importPath) => {
  console.log(`\n\n${'━'.repeat(50)}`)
  console.log(`📁 ${name}`)
  console.log('━'.repeat(50))

  resetResults()

  try {
    const module = await import(importPath)
    const results = module.default()
    // Results are printed by runTests, but we need to track totals
  } catch (error) {
    console.error(`\n❌ Error running ${name}:`, error.message)
    totalFailed++
  }
}

const main = async () => {
  const startTime = performance.now()

  // Run all test suites
  await runSuite('Core Tests', './core.test.js')
  await runSuite('Features Tests', './features.test.js')
  await runSuite('Utils Tests', './utils.test.js')
  await runSuite('Non-Secure Tests', './non-secure.test.js')

  const duration = ((performance.now() - startTime) / 1000).toFixed(2)

  console.log('\n' + '═'.repeat(50))
  console.log(`\n⏱️  Total time: ${duration}s`)
  console.log('═'.repeat(50))

  // Run performance benchmark
  console.log('\n📊 Performance Benchmark')
  console.log('─'.repeat(50))

  const { nopeid } = await import('../index.js')
  const { nopeid: nopeidNonSecure } = await import('../non-secure/index.js')

  const iterations = 100000

  // Secure version
  let start = performance.now()
  for (let i = 0; i < iterations; i++) {
    nopeid()
  }
  let secureTime = performance.now() - start
  let secureOps = Math.round(iterations / (secureTime / 1000))

  // Non-secure version
  start = performance.now()
  for (let i = 0; i < iterations; i++) {
    nopeidNonSecure()
  }
  let nonSecureTime = performance.now() - start
  let nonSecureOps = Math.round(iterations / (nonSecureTime / 1000))

  console.log(`\n   Secure:     ${secureOps.toLocaleString()} ops/sec (${secureTime.toFixed(2)}ms)`)
  console.log(`   Non-secure: ${nonSecureOps.toLocaleString()} ops/sec (${nonSecureTime.toFixed(2)}ms)`)
  console.log(`   Speedup:    ${(nonSecureOps / secureOps).toFixed(2)}x faster (non-secure)`)

  console.log('\n' + '═'.repeat(50))
  console.log('\n✨ All test suites completed!\n')
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
