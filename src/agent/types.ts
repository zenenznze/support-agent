import type { ProviderKind } from '../providers/types.js'
import type { DocSearchResult } from '../docs/types.js'

export type SupportRoute = 'direct-hit' | `retrieval+${ProviderKind}` | `provider+${ProviderKind}`

export interface SupportAgentInput {
  sessionId: string
  message: string
  metadata?: unknown
}

export interface DirectHitResult {
  answer: string
  route: 'direct-hit'
  intent: string
  model: 'direct-hit-rules'
  citations: []
}

export interface FastSupportAgentResult {
  answer: string
  route: SupportRoute
  model: string
  intent?: string
  citations: DocSearchResult[]
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}
