import { tokenizeText } from './indexer.js'
import type { DocIndex, DocSearchResult, SearchOptions } from './types.js'

function snippetFor(content: string, queryTokens: string[]): string {
  const normalized = content.replace(/\s+/g, ' ').trim()
  const lower = normalized.toLowerCase()
  const firstMatch = queryTokens
    .map(token => lower.indexOf(token))
    .filter(index => index >= 0)
    .sort((a, b) => a - b)[0]

  if (firstMatch === undefined) {
    return normalized.slice(0, 180)
  }

  const start = Math.max(0, firstMatch - 60)
  const end = Math.min(normalized.length, firstMatch + 140)
  return normalized.slice(start, end)
}

export function searchDocIndex(index: DocIndex, query: string, options: SearchOptions = {}): DocSearchResult[] {
  const queryTokens = Array.from(new Set(tokenizeText(query)))
  if (queryTokens.length === 0) {
    return []
  }

  const scored = index.documents.map(document => {
    const titleTokens = new Set(tokenizeText(document.title))
    const docTokens = new Set(document.tokens)
    const score = queryTokens.reduce((total, token) => {
      if (titleTokens.has(token)) {
        return total + 3
      }

      if (docTokens.has(token)) {
        return total + 1
      }

      return total
    }, 0)

    return {
      path: document.path,
      title: document.title,
      snippet: snippetFor(document.content, queryTokens),
      score
    }
  }).filter(result => result.score > 0)

  return scored
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, options.limit ?? 5)
}
