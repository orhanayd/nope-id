// Test utilities - Simple test framework
const results = {
  passed: 0,
  failed: 0,
  tests: [],
}

let currentDescribe = ''

export const describe = (name, fn) => {
  currentDescribe = name
  console.log(`\n📦 ${name}`)
  fn()
}

export const test = (name, fn) => {
  const testName = `${currentDescribe} > ${name}`
  try {
    fn()
    results.passed++
    results.tests.push({ name: testName, passed: true })
    console.log(`  ✅ ${name}`)
  } catch (error) {
    results.failed++
    results.tests.push({ name: testName, passed: false, error: error.message })
    console.log(`  ❌ ${name}`)
    console.log(`     Error: ${error.message}`)
  }
}

export const assert = {
  equal(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(
        message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
      )
    }
  },

  notEqual(actual, expected, message = '') {
    if (actual === expected) {
      throw new Error(message || `Expected values to be different, both are ${JSON.stringify(actual)}`)
    }
  },

  ok(value, message = '') {
    if (!value) {
      throw new Error(message || `Expected truthy value, got ${JSON.stringify(value)}`)
    }
  },

  notOk(value, message = '') {
    if (value) {
      throw new Error(message || `Expected falsy value, got ${JSON.stringify(value)}`)
    }
  },

  match(string, regex, message = '') {
    if (!regex.test(string)) {
      throw new Error(message || `Expected "${string}" to match ${regex}`)
    }
  },

  notMatch(string, regex, message = '') {
    if (regex.test(string)) {
      throw new Error(message || `Expected "${string}" not to match ${regex}`)
    }
  },

  throws(fn, message = '') {
    let threw = false
    try {
      fn()
    } catch {
      threw = true
    }
    if (!threw) {
      throw new Error(message || 'Expected function to throw')
    }
  },

  async rejects(promise, message = '') {
    let rejected = false
    try {
      await promise
    } catch {
      rejected = true
    }
    if (!rejected) {
      throw new Error(message || 'Expected promise to reject')
    }
  },

  deepEqual(actual, expected, message = '') {
    const actualStr = JSON.stringify(actual)
    const expectedStr = JSON.stringify(expected)
    if (actualStr !== expectedStr) {
      throw new Error(message || `Expected ${expectedStr}, got ${actualStr}`)
    }
  },

  arrayIncludes(array, item, message = '') {
    if (!array.includes(item)) {
      throw new Error(message || `Expected array to include ${JSON.stringify(item)}`)
    }
  },

  type(value, expectedType, message = '') {
    const actualType = typeof value
    if (actualType !== expectedType) {
      throw new Error(message || `Expected type ${expectedType}, got ${actualType}`)
    }
  },

  instanceOf(value, constructor, message = '') {
    if (!(value instanceof constructor)) {
      throw new Error(message || `Expected instance of ${constructor.name}`)
    }
  },

  greaterThan(actual, expected, message = '') {
    if (actual <= expected) {
      throw new Error(message || `Expected ${actual} to be greater than ${expected}`)
    }
  },

  lessThan(actual, expected, message = '') {
    if (actual >= expected) {
      throw new Error(message || `Expected ${actual} to be less than ${expected}`)
    }
  },

  between(value, min, max, message = '') {
    if (value < min || value > max) {
      throw new Error(message || `Expected ${value} to be between ${min} and ${max}`)
    }
  },
}

export const runTests = () => {
  console.log('\n' + '='.repeat(50))
  console.log(`\n📊 Test Results: ${results.passed} passed, ${results.failed} failed`)

  if (results.failed > 0) {
    console.log('\n❌ Failed tests:')
    results.tests
      .filter(t => !t.passed)
      .forEach(t => {
        console.log(`   - ${t.name}`)
        console.log(`     ${t.error}`)
      })
    process.exit(1)
  } else {
    console.log('\n🎉 All tests passed!\n')
  }

  return results
}

export const resetResults = () => {
  results.passed = 0
  results.failed = 0
  results.tests = []
}
