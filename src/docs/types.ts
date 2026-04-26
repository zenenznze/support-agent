export interface SupportDoc {
  path: string
  title: string
  content: string
}

export interface IndexedSupportDoc extends SupportDoc {
  tokens: string[]
}

export interface DocIndex {
  version: 1
  builtAt: string
  documents: IndexedSupportDoc[]
}

export interface DocSearchResult {
  path: string
  title: string
  snippet: string
  score: number
}

export interface SearchOptions {
  limit?: number
}
