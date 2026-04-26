import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, it } from 'node:test'
import { buildDocIndex } from '../src/docs/indexer.js'
import { loadMarkdownDocs } from '../src/docs/loader.js'
import { searchDocIndex } from '../src/docs/search.js'
import type { DocIndex } from '../src/docs/types.js'

const fixturesDir = path.resolve('tests/fixtures/public/docs')
let tempDir: string | undefined

describe('support docs index and search', () => {
  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
  })

  it('loads public markdown docs recursively with title, relative path, and content', async () => {
    const docs = await loadMarkdownDocs(fixturesDir)

    assert.deepEqual(docs.map(doc => doc.path).sort(), [
      'account-login.md',
      'billing/invoices.md'
    ])

    const login = docs.find(doc => doc.path === 'account-login.md')
    assert.ok(login)
    assert.equal(login.title, 'Account login troubleshooting')
    assert.match(login.content, /reset the password/)
  })

  it('builds a serializable token index and searches by keyword with snippets', async () => {
    const docs = await loadMarkdownDocs(fixturesDir)
    const index = buildDocIndex(docs)

    assert.equal(index.version, 1)
    assert.equal(index.documents.length, 2)
    assert.ok(index.documents.every(document => document.tokens.length > 0))
    JSON.parse(JSON.stringify(index)) as DocIndex

    const results = searchDocIndex(index, 'invoice payment card', { limit: 1 })

    assert.equal(results.length, 1)
    assert.equal(results[0]?.path, 'billing/invoices.md')
    assert.equal(results[0]?.title, 'Billing invoice help')
    assert.ok((results[0]?.score ?? 0) > 0)
    assert.match(results[0]?.snippet ?? '', /failed payments/i)
  })

  it('returns an empty result list for blank or unmatched queries', async () => {
    const index = buildDocIndex(await loadMarkdownDocs(fixturesDir))

    assert.deepEqual(searchDocIndex(index, '   '), [])
    assert.deepEqual(searchDocIndex(index, 'nonexistentterm'), [])
  })

  it('build-doc-index script writes a JSON index to the requested output path', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'support-agent-index-'))
    const outPath = path.join(tempDir, 'index.json')

    const result = spawnSync(process.execPath, [
      'dist/scripts/build-doc-index.js',
      '--docs',
      fixturesDir,
      '--out',
      outPath
    ], {
      cwd: process.cwd(),
      encoding: 'utf8'
    })

    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /Indexed 2 documents/)

    const index = JSON.parse(await readFile(outPath, 'utf8')) as DocIndex
    assert.equal(index.version, 1)
    assert.deepEqual(index.documents.map(document => document.path).sort(), [
      'account-login.md',
      'billing/invoices.md'
    ])
  })
})
