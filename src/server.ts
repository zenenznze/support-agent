import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { DEFAULT_VERSION, loadConfig, type SupportAgentConfig } from './config.js'
import { HttpError, toErrorBody } from './http/errors.js'
import { createProvider } from './providers/factory.js'
import type { ChatProvider } from './providers/types.js'

interface StartServerOptions {
  port?: number
  config?: Partial<SupportAgentConfig>
}

interface ChatRequestBody {
  sessionId?: unknown
  message?: unknown
  metadata?: unknown
}

export interface SupportAgentServer {
  url: string
  close: () => Promise<void>
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload)
  })
  res.end(payload)
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw)
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', 'invalid json body')
  }
}

function traceId() {
  return `trace_${randomUUID().replaceAll('-', '').slice(0, 16)}`
}

function normalizeSessionId(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  return `session_${randomUUID().replaceAll('-', '').slice(0, 12)}`
}

function requireMessage(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, 'BAD_REQUEST', 'message is required')
  }
  return value.trim()
}

async function handleChat(req: IncomingMessage, res: ServerResponse, config: SupportAgentConfig, provider: ChatProvider) {
  const startedAt = performance.now()
  const body = (await readJson(req)) as ChatRequestBody
  const sessionId = normalizeSessionId(body.sessionId)
  const message = requireMessage(body.message)
  const completion = await provider.complete(
    {
      sessionId,
      message,
      metadata: body.metadata
    },
    { timeoutMs: config.provider.timeoutMs }
  )

  sendJson(res, 200, {
    ok: true,
    sessionId,
    answer: completion.answer,
    traceId: traceId(),
    latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
    route: completion.route,
    model: completion.model,
    usage: completion.usage
  })
}

function createRequestHandler(config: SupportAgentConfig, provider: ChatProvider) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, {
          ok: true,
          service: 'support-agent',
          version: config.version
        })
        return
      }

      if (req.method === 'POST' && url.pathname === '/v1/chat') {
        await handleChat(req, res, config, provider)
        return
      }

      throw new HttpError(404, 'NOT_FOUND', 'not found')
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.statusCode, toErrorBody(error))
        return
      }

      sendJson(res, 500, {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'internal server error'
        }
      })
    }
  }
}

export async function startServer(options: StartServerOptions = {}): Promise<SupportAgentServer> {
  const baseConfig = loadConfig()
  const config: SupportAgentConfig = {
    port: options.port ?? options.config?.port ?? baseConfig.port,
    version: options.config?.version ?? baseConfig.version ?? DEFAULT_VERSION,
    provider: options.config?.provider ?? baseConfig.provider
  }
  const provider = createProvider(config.provider)
  const server = http.createServer(createRequestHandler(config, provider))

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(config.port, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('server did not expose a TCP address')
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = await startServer()
  console.log(`support-agent listening on ${server.url}`)
}
