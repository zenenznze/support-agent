import { AnthropicMessagesProvider } from './anthropic-messages.js'
import { MockProvider } from './mock-provider.js'
import { OpenAICompatibleProvider } from './openai-compatible.js'
import { OpenAIResponsesProvider } from './openai-responses.js'
import type { ChatProvider, ProviderConfig } from './types.js'

export function createProvider(config: ProviderConfig): ChatProvider {
  if (config.kind === 'mock') {
    return new MockProvider()
  }

  if (config.kind === 'openai-compatible') {
    return new OpenAICompatibleProvider({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs
    })
  }

  if (config.kind === 'openai-responses') {
    return new OpenAIResponsesProvider({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs
    })
  }

  return new AnthropicMessagesProvider({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    timeoutMs: config.timeoutMs
  })
}
