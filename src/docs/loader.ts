import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { SupportDoc } from './types.js'

function extractTitle(content: string, filePath: string): string {
  const heading = content.split(/\r?\n/).find(line => line.trim().startsWith('# '))
  if (heading) {
    return heading.replace(/^#\s+/, '').trim()
  }

  return path.basename(filePath, path.extname(filePath))
}

async function walkMarkdownFiles(rootDir: string, currentDir: string): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const absolute = path.join(currentDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walkMarkdownFiles(rootDir, absolute))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path.relative(rootDir, absolute).split(path.sep).join('/'))
    }
  }

  return files.sort()
}

export async function loadMarkdownDocs(docsDir: string): Promise<SupportDoc[]> {
  const rootDir = path.resolve(docsDir)
  const relativePaths = await walkMarkdownFiles(rootDir, rootDir)

  return Promise.all(relativePaths.map(async relativePath => {
    const absolute = path.join(rootDir, relativePath)
    const content = await readFile(absolute, 'utf8')

    return {
      path: relativePath,
      title: extractTitle(content, relativePath),
      content
    }
  }))
}
