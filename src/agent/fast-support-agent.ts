import { searchDocIndex } from '../docs/search.js'
import type { DocIndex, DocSearchResult } from '../docs/types.js'
import type { ChatProvider } from '../providers/types.js'
import { findDirectHit } from './direct-hit.js'
import { buildSupportSystemPrompt } from '../prompts/support-system.js'
import type { FastSupportAgentResult, SupportAgentInput } from './types.js'

export interface FastSupportAgentOptions {
  provider: ChatProvider
  providerTimeoutMs: number
  maxProviderTimeoutMs?: number
  docIndex?: DocIndex
  docsLimit?: number
}

const DEFAULT_MAX_PROVIDER_TIMEOUT_MS = 15000
const DEFAULT_DOCS_LIMIT = 3

function elapsedMs(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt))
}

function boundedTimeout(providerTimeoutMs: number, maxProviderTimeoutMs = DEFAULT_MAX_PROVIDER_TIMEOUT_MS): number {
  return Math.max(1, Math.min(providerTimeoutMs, maxProviderTimeoutMs))
}

function withSupportContext(message: string, citations: DocSearchResult[]): string {
  const prompt = buildSupportSystemPrompt(citations)
  return `${prompt}\n\nCustomer message:\n${message}`
}

export async function runFastSupportAgent(
  input: SupportAgentInput,
  options: FastSupportAgentOptions
): Promise<FastSupportAgentResult> {
  const totalStartedAt = performance.now()
  const directHit = findDirectHit(input.message)
  if (directHit) {
    return directHit
  }

  const retrievalStartedAt = performance.now()
  const citations = options.docIndex ? searchDocIndex(options.docIndex, input.message, { limit: options.docsLimit ?? DEFAULT_DOCS_LIMIT }) : []
  const retrievalMs = elapsedMs(retrievalStartedAt)
  const providerStartedAt = performance.now()
  const completion = await options.provider.complete(
    {
      sessionId: input.sessionId,
      message: withSupportContext(input.message, citations),
      metadata: input.metadata
    },
    { timeoutMs: boundedTimeout(options.providerTimeoutMs, options.maxProviderTimeoutMs) }
  )
  const providerMs = elapsedMs(providerStartedAt)

  return {
    answer: completion.answer,
    route: citations.length > 0 ? `retrieval+${completion.route}` : `provider+${completion.route}`,
    model: completion.model,
    citations,
    latency: {
      retrievalMs,
      providerMs,
      totalMs: elapsedMs(totalStartedAt)
    },
    usage: completion.usage
  }
}
