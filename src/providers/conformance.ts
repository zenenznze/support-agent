import type { ChatCompletionOutput } from './types.js'

type PartialUsage = Partial<NonNullable<ChatCompletionOutput['usage']>>

export interface ProviderOutputDraft extends Omit<ChatCompletionOutput, 'usage'> {
  usage?: PartialUsage
}

export interface ProviderErrorSafetyOptions {
  providerName: string
  forbiddenSubstrings: string[]
}

function normalizeTokenCount(value: number | undefined): number {
  return Number.isFinite(value) && value !== undefined && value >= 0 ? value : 0
}

export function normalizeProviderOutput(providerName: string, output: ProviderOutputDraft): ChatCompletionOutput {
  const answer = output.answer.trim()
  if (!answer) {
    throw new Error(`${providerName} provider returned an empty assistant message`)
  }

  const model = output.model.trim()
  if (!model) {
    throw new Error(`${providerName} provider returned an empty model`)
  }

  return {
    answer,
    model,
    route: output.route,
    usage: output.usage
      ? {
          inputTokens: normalizeTokenCount(output.usage.inputTokens),
          outputTokens: normalizeTokenCount(output.usage.outputTokens)
        }
      : undefined
  }
}

export function assertProviderErrorSafe(error: unknown, options: ProviderErrorSafetyOptions): asserts error is Error {
  if (!(error instanceof Error)) {
    throw new Error(`${options.providerName} provider threw a non-Error value`)
  }

  if (!error.message.includes(`${options.providerName} provider`)) {
    throw new Error(`${options.providerName} provider error did not include provider context`)
  }

  for (const forbidden of options.forbiddenSubstrings) {
    if (forbidden && error.message.includes(forbidden)) {
      throw new Error(`${options.providerName} provider error leaked forbidden content`)
    }
  }
}
