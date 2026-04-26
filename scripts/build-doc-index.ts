import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildDocIndex } from '../src/docs/indexer.js'
import { loadMarkdownDocs } from '../src/docs/loader.js'

interface CliArgs {
  docs: string
  out: string
}

function parseArgs(argv: string[]): CliArgs {
  let docs = process.env.SUPPORT_AGENT_DOCS_DIR || 'tests/fixtures/public/docs'
  let out = 'local-data/indexes/support-doc-index.json'

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--docs') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('--docs requires a path')
      }
      docs = value
      index += 1
      continue
    }

    if (arg === '--out') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('--out requires a path')
      }
      out = value
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return { docs, out }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const docs = await loadMarkdownDocs(args.docs)
  const index = buildDocIndex(docs)
  const outPath = path.resolve(args.out)

  await mkdir(path.dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8')

  console.log(`Indexed ${docs.length} documents to ${outPath}`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
