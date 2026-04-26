import { DIRECT_HIT_RULES, toDirectHit } from './direct-hit-rules.js'
import type { DirectHitResult } from './types.js'

export function findDirectHit(message: string): DirectHitResult | undefined {
  const normalized = message.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return undefined
  }

  const rule = DIRECT_HIT_RULES.find(candidate => candidate.patterns.some(pattern => pattern.test(normalized)))
  return rule ? toDirectHit(rule) : undefined
}
