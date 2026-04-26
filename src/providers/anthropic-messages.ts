import { normalizeProviderOutput } from './conformance.js'
import type {
  AnthropicMessagesProviderConfig,
  ChatCompletionInput,
  ChatCompletionOutput,
  ChatProvider,
  CompletionOptions
} from './types.js'

const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MAX_TOKENS = 1024

interface AnthropicMessagesResponse {
  model?: string
  content?: Array<{
    type?: string
    text?: string
  }>
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
  error?: {
    message?: string
  }
}

function messagesEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '')
  return normalized.endsWith('/v1') ? `${normalized}/messages` : `${normalized}/v1/messages`
}

function extractText(payload: AnthropicMessagesResponse): string | undefined {
  for (const content of payload.content ?? []) {
    if (content.type === 'text' || content.type === undefined) {
      const text = content.text?.trim()
      if (text) {
        return text
      }
    }
  }

  return undefined
}

export class AnthropicMessagesProvider implements ChatProvider {
  private readonly endpoint: string
  private readonly apiKey: string
  private readonly model: string
  private readonly timeoutMs: number

  constructor(config: Omit<AnthropicMessagesProviderConfig, 'kind'>) {
    if (!config.apiKey.trim()) {
      throw new Error('SUPPORT_AGENT_API_KEY is required for anthropic-messages provider')
    }
    if (!config.baseUrl.trim()) {
      throw new Error('SUPPORT_AGENT_PROVIDER_BASE_URL is required for anthropic-messages provider')
    }
    if (!config.model.trim()) {
      throw new Error('SUPPORT_AGENT_MODEL is required for anthropic-messages provider')
    }

    this.endpoint = messagesEndpoint(config.baseUrl)
    this.apiKey = config.apiKey
    this.model = config.model
    this.timeoutMs = config.timeoutMs
  }

  async complete(input: ChatCompletionInput, options: CompletionOptions): Promise<ChatCompletionOutput> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs)

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: DEFAULT_MAX_TOKENS,
          messages: [
            {
              role: 'user',
              content: input.message
            }
          ],
          metadata: {
            user_id: input.sessionId
          }
        }),
        signal: controller.signal
      })

      const payload = (await response.json().catch(() => ({}))) as AnthropicMessagesResponse

      if (!response.ok) {
        const message = payload.error?.message || response.statusText || 'unknown error'
        throw new Error(`Anthropic Messages provider failed with status ${response.status}: ${message}`)
      }

      const answer = extractText(payload)
      if (!answer) {
        throw new Error('Anthropic Messages provider returned an empty assistant message')
      }

      return normalizeProviderOutput('Anthropic Messages', {
        answer,
        model: payload.model || this.model,
        route: 'anthropic-messages',
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
