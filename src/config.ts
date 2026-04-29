import type { ProviderConfig, ProviderKind } from './providers/types.js'

export interface SupportDocsConfig {
  indexPath?: string
  docsDir?: string
}

export interface SupportLatencyConfig {
  onlineProviderTimeoutMs: number
  qualityReplayProviderTimeoutMs: number
}

export interface SupportAgentConfig {
  port: number
  version: string
  provider: ProviderConfig
  docs?: SupportDocsConfig
  latency: SupportLatencyConfig
}

export const DEFAULT_VERSION = '0.1.0'
export const DEFAULT_PORT = 8790
export const DEFAULT_PROVIDER_TIMEOUT_MS = 30000
export const DEFAULT_ONLINE_PROVIDER_TIMEOUT_MS = 15000
export const DEFAULT_QUALITY_REPLAY_PROVIDER_TIMEOUT_MS = 60000
export const DEFAULT_OPENAI_COMPATIBLE_MODEL = 'gpt-4o-mini'
export const DEFAULT_ANTHROPIC_MESSAGES_MODEL = 'claude-3-5-haiku-latest'

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseProvider(env: NodeJS.ProcessEnv): ProviderConfig {
  const kind = (env.SUPPORT_AGENT_PROVIDER || 'mock') as ProviderKind
  const timeoutMs = parsePositiveInt(env.SUPPORT_AGENT_TIMEOUT_MS, DEFAULT_PROVIDER_TIMEOUT_MS)

  if (kind === 'mock') {
    return { kind, timeoutMs }
  }

  if (kind === 'openai-compatible' || kind === 'openai-responses') {
    return {
      kind,
      baseUrl: env.SUPPORT_AGENT_PROVIDER_BASE_URL || 'https://api.openai.com/v1',
      apiKey: env.SUPPORT_AGENT_API_KEY || '',
      model: env.SUPPORT_AGENT_MODEL || DEFAULT_OPENAI_COMPATIBLE_MODEL,
      timeoutMs
    }
  }

  if (kind === 'anthropic-messages') {
    return {
      kind,
      baseUrl: env.SUPPORT_AGENT_PROVIDER_BASE_URL || 'https://api.anthropic.com',
      apiKey: env.SUPPORT_AGENT_API_KEY || '',
      model: env.SUPPORT_AGENT_MODEL || DEFAULT_ANTHROPIC_MESSAGES_MODEL,
      timeoutMs
    }
  }

  throw new Error(`Unsupported SUPPORT_AGENT_PROVIDER: ${kind}`)
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SupportAgentConfig {
  const rawPort = env.PORT ?? env.SUPPORT_AGENT_PORT
  const parsedPort = parsePositiveInt(rawPort, DEFAULT_PORT)

  return {
    port: parsedPort,
    version: env.SUPPORT_AGENT_VERSION || DEFAULT_VERSION,
    provider: parseProvider(env),
    docs: {
      indexPath: env.SUPPORT_AGENT_DOC_INDEX_PATH,
      docsDir: env.SUPPORT_AGENT_DOCS_DIR
    },
    latency: {
      onlineProviderTimeoutMs: parsePositiveInt(env.SUPPORT_AGENT_PROVIDER_TIMEOUT_MS, DEFAULT_ONLINE_PROVIDER_TIMEOUT_MS),
      qualityReplayProviderTimeoutMs: parsePositiveInt(env.SUPPORT_AGENT_QUALITY_REPLAY_TIMEOUT_MS, DEFAULT_QUALITY_REPLAY_PROVIDER_TIMEOUT_MS)
    }
  }
}
