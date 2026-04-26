import { normalizeProviderOutput } from './conformance.js'
import type {
  ChatCompletionInput,
  ChatCompletionOutput,
  ChatProvider,
  CompletionOptions,
  OpenAIResponsesProviderConfig
} from './types.js'

interface OpenAIResponsesResponse {
  model?: string
  output_text?: string
  output?: Array<{
    type?: string
    role?: string
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
  error?: {
    message?: string
  }
}

function extractResponseText(payload: OpenAIResponsesResponse): string | undefined {
  const directText = payload.output_text?.trim()
  if (directText) {
    return directText
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      const text = content.text?.trim()
      if (text) {
        return text
      }
    }
  }

  return undefined
}

export class OpenAIResponsesProvider implements ChatProvider {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly model: string
  private readonly timeoutMs: number

  constructor(config: Omit<OpenAIResponsesProviderConfig, 'kind'>) {
    if (!config.apiKey.trim()) {
      throw new Error('SUPPORT_AGENT_API_KEY is required for openai-responses provider')
    }
    if (!config.baseUrl.trim()) {
      throw new Error('SUPPORT_AGENT_PROVIDER_BASE_URL is required for openai-responses provider')
    }
    if (!config.model.trim()) {
      throw new Error('SUPPORT_AGENT_MODEL is required for openai-responses provider')
    }

    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.model = config.model
    this.timeoutMs = config.timeoutMs
  }

  async complete(input: ChatCompletionInput, options: CompletionOptions): Promise<ChatCompletionOutput> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs)

    try {
      const response = await fetch(`${this.baseUrl}/responses`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          input: input.message,
          metadata: input.metadata
        }),
        signal: controller.signal
      })

      const payload = (await response.json().catch(() => ({}))) as OpenAIResponsesResponse

      if (!response.ok) {
        const message = payload.error?.message || response.statusText || 'unknown error'
        throw new Error(`OpenAI Responses provider failed with status ${response.status}: ${message}`)
      }

      const answer = extractResponseText(payload)
      if (!answer) {
        throw new Error('OpenAI Responses provider returned an empty assistant message')
      }

      return normalizeProviderOutput('OpenAI Responses', {
        answer,
        model: payload.model || this.model,
        route: 'openai-responses',
        usage: {
          inputTokens: payload.usage?.input_tokens,
          outputTokens: payload.usage?.output_tokens
        }
      })
    } finally {
      clearTimeout(timeout)
    }
  }
}
