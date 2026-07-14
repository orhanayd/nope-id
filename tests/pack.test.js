// Pack-manifest guard — pins the exact npm tarball contents.
// nanoid shipped .claude/settings.local.json and .devcontainer.json to npm
// (ai/nanoid#590, #523); the "non-secure" directory entry in "files" would
// likewise ship any stray file dropped into that folder. `npm pack --dry-run`
// is offline-safe (~1s). Spawns `npm` from PATH (darwin/linux; Windows would
// need npm.cmd — out of scope).
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test, describe, runTests, assert } from './test-utils.js'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

const EXPECTED_FILES = [
  'LICENSE',
  'README.md',
  'index.browser.js',
  'index.cjs',
  'index.d.ts',
  'index.js',
  'non-secure/index.cjs',
  'non-secure/index.d.ts',
  'non-secure/index.js',
  'package.json',
]

describe('npm tarball manifest', () => {
  const report = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }))[0]
  const files = report.files.map(f => f.path).sort()

  test('ships exactly the expected 10 files', () => {
    assert.deepEqual(files, EXPECTED_FILES)
    assert.equal(report.entryCount, EXPECTED_FILES.length)
  })

  test('no dotfiles, configs or dev artifacts can slip in', () => {
    const allowed = /^(LICENSE|README\.md|package\.json|index\.(js|cjs|browser\.js|d\.ts)|non-secure\/index\.(js|cjs|d\.ts))$/
    for (const f of files) {
      assert.notMatch(f, /(^|\/)\./, `dotfile in tarball: ${f}`)
      assert.match(f, allowed, `unexpected file in tarball: ${f}`)
    }
  })
})

export default runTests

if (process.argv[1] === fileURLToPath(import.meta.url)) runTests()
