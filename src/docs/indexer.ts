import type { DocIndex, SupportDoc } from './types.js'

const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu

export function tokenizeText(text: string): string[] {
  return Array.from(text.toLowerCase().matchAll(TOKEN_PATTERN), match => match[0])
}

export function buildDocIndex(docs: SupportDoc[], builtAt = new Date().toISOString()): DocIndex {
  return {
    version: 1,
    builtAt,
    documents: docs.map(doc => ({
      ...doc,
      tokens: tokenizeText(`${doc.title}\n${doc.content}`)
    }))
  }
}
