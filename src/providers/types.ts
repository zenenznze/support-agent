export type ProviderKind = 'mock' | 'openai-compatible' | 'openai-responses' | 'anthropic-messages'

export interface ChatCompletionInput {
  sessionId: string
  message: string
  metadata?: unknown
}

export interface CompletionOptions {
  timeoutMs: number
}

export interface ChatCompletionUsage {
  inputTokens: number
  outputTokens: number
}

export interface ChatCompletionOutput {
  answer: string
  model: string
  route: ProviderKind
  usage?: ChatCompletionUsage
}

export interface ChatProvider {
  complete(input: ChatCompletionInput, options: CompletionOptions): Promise<ChatCompletionOutput>
}

export interface MockProviderConfig {
  kind: 'mock'
  timeoutMs: number
}

export interface OpenAICompatibleProviderConfig {
  kind: 'openai-compatible'
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
}

export interface OpenAIResponsesProviderConfig {
  kind: 'openai-responses'
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
}

export interface AnthropicMessagesProviderConfig {
  kind: 'anthropic-messages'
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
}

export type ProviderConfig = MockProviderConfig | OpenAICompatibleProviderConfig | OpenAIResponsesProviderConfig | AnthropicMessagesProviderConfig
