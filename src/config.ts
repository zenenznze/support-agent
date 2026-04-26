export interface SupportAgentConfig {
  port: number
  version: string
}

export const DEFAULT_VERSION = '0.1.0'
export const DEFAULT_PORT = 8790

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SupportAgentConfig {
  const rawPort = env.PORT ?? env.SUPPORT_AGENT_PORT
  const parsedPort = rawPort ? Number.parseInt(rawPort, 10) : DEFAULT_PORT

  return {
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT,
    version: env.SUPPORT_AGENT_VERSION || DEFAULT_VERSION
  }
}
