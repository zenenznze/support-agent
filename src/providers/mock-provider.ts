import type { ChatCompletionInput, ChatCompletionOutput, ChatProvider, CompletionOptions } from './types.js'

export class MockProvider implements ChatProvider {
  async complete(_input: ChatCompletionInput, _options: CompletionOptions): Promise<ChatCompletionOutput> {
    return {
      answer: 'mock support answer',
      model: 'mock',
      route: 'mock',
      usage: {
        inputTokens: 0,
        outputTokens: 0
      }
    }
  }
}
