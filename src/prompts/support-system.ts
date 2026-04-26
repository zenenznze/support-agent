import type { DocSearchResult } from '../docs/types.js'

export function buildSupportSystemPrompt(citations: DocSearchResult[]): string {
  const guardrails = [
    'You are a concise support agent for a test support line.',
    'Use the provided public support docs context when it is relevant.',
    'Do not claim access to private tickets, private documents, real sessions, or hidden logs.',
    'If the context is insufficient, ask for one concrete missing detail or provide safe next steps.',
    'Keep the answer short, actionable, and customer-facing.'
  ].join(' ')

  if (citations.length === 0) {
    return guardrails
  }

  const context = citations.map((citation, index) => {
    return `[${index + 1}] ${citation.title} (${citation.path})\n${citation.snippet}`
  }).join('\n\n')

  return `${guardrails}\n\nSupport docs context:\n${context}`
}
