import { normalizeProviderOutput } from './conformance.js'
import type {
  ChatCompletionInput,
  ChatCompletionOutput,
  ChatProvider,
  CompletionOptions,
  OpenAICompatibleProviderConfig
} from './types.js'

interface OpenAIChatCompletionResponse {
  model?: string
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
  error?: {
    message?: string
  }
}

export class OpenAICompatibleProvider implements ChatProvider {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly model: string
  private readonly timeoutMs: number

  constructor(config: Omit<OpenAICompatibleProviderConfig, 'kind'>) {
    if (!config.apiKey.trim()) {
      throw new Error('SUPPORT_AGENT_API_KEY is required for openai-compatible provider')
    }
    if (!config.baseUrl.trim()) {
      throw new Error('SUPPORT_AGENT_PROVIDER_BASE_URL is required for openai-compatible provider')
    }
    if (!config.model.trim()) {
      throw new Error('SUPPORT_AGENT_MODEL is required for openai-compatible provider')
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
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a concise support assistant. Answer directly and only use verified context when available.'
            },
            {
              role: 'user',
              content: input.message
            }
          ],
          metadata: input.metadata
        }),
        signal: controller.signal
      })

      const payload = (await response.json().catch(() => ({}))) as OpenAIChatCompletionResponse

      if (!response.ok) {
        const message = payload.error?.message || response.statusText || 'unknown error'
        throw new Error(`OpenAI-compatible provider failed with status ${response.status}: ${message}`)
      }

      const answer = payload.choices?.[0]?.message?.content?.trim()
      if (!answer) {
        throw new Error('OpenAI-compatible provider returned an empty assistant message')
      }

      return normalizeProviderOutput('OpenAI-compatible', {
        answer,
        model: payload.model || this.model,
        route: 'openai-compatible',
        usage: {
          inputTokens: payload.usage?.prompt_tokens,
          outputTokens: payload.usage?.completion_tokens
        }
      })
    } finally {
      clearTimeout(timeout)
    }
  }
}
