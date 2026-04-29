import type { ProviderKind } from '../providers/types.js'
import type { DocSearchResult } from '../docs/types.js'

export type SupportRoute = 'direct-hit' | `retrieval+${ProviderKind}` | `provider+${ProviderKind}`

export interface SupportAgentInput {
  sessionId: string
  message: string
  metadata?: unknown
}

export interface SupportAgentLatency {
  retrievalMs: number
  providerMs: number
  totalMs: number
}

export interface DirectHitResult {
  answer: string
  route: 'direct-hit'
  intent: string
  model: 'direct-hit-rules'
  citations: []
  latency: SupportAgentLatency
}

export interface FastSupportAgentResult {
  answer: string
  route: SupportRoute
  model: string
  intent?: string
  citations: DocSearchResult[]
  latency: SupportAgentLatency
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}
