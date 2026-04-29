import assert from 'node:assert/strict'
import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import { afterEach, describe, it } from 'node:test'
import { loadConfig } from '../src/config.js'
import { MockProvider } from '../src/providers/mock-provider.js'
import { OpenAICompatibleProvider } from '../src/providers/openai-compatible.js'

interface TestServer {
  url: string
  requests: unknown[]
  close: () => Promise<void>
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

async function startOpenAITestServer(handler: (req: IncomingMessage, res: ServerResponse, body: unknown, requests: unknown[]) => void | Promise<void>): Promise<TestServer> {
  const requests: unknown[] = []
  const server = http.createServer(async (req, res) => {
    const body = await readJson(req)
    requests.push({ method: req.method, url: req.url, headers: req.headers, body })
    await handler(req, res, body, requests)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  const address = server.address()
  assert.ok(address && typeof address !== 'string')

  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
  }
}

describe('provider configuration', () => {
  it('defaults to mock provider and reads OpenAI-compatible environment variables', () => {
    const config = loadConfig({
      SUPPORT_AGENT_PROVIDER: 'openai-compatible',
      SUPPORT_AGENT_PROVIDER_BASE_URL: 'https://example.test/v1',
      SUPPORT_AGENT_API_KEY: 'fake-key',
      SUPPORT_AGENT_MODEL: 'gpt-test',
      SUPPORT_AGENT_TIMEOUT_MS: '12345'
    })

    assert.equal(config.provider.kind, 'openai-compatible')
    assert.equal(config.provider.baseUrl, 'https://example.test/v1')
    assert.equal(config.provider.apiKey, 'fake-key')
    assert.equal(config.provider.model, 'gpt-test')
    assert.equal(config.provider.timeoutMs, 12345)

    const defaultConfig = loadConfig({})
    assert.equal(defaultConfig.provider.kind, 'mock')
    assert.equal(defaultConfig.latency.onlineProviderTimeoutMs, 15000)
    assert.equal(defaultConfig.latency.qualityReplayProviderTimeoutMs, 60000)
  })

  it('reads fast-loop latency budget environment variables', () => {
    const config = loadConfig({
      SUPPORT_AGENT_PROVIDER_TIMEOUT_MS: '15000',
      SUPPORT_AGENT_QUALITY_REPLAY_TIMEOUT_MS: '45000'
    })

    assert.equal(config.latency.onlineProviderTimeoutMs, 15000)
    assert.equal(config.latency.qualityReplayProviderTimeoutMs, 45000)
  })
})

describe('MockProvider', () => {
  it('returns a stable mock completion while preserving input metadata', async () => {
    const provider = new MockProvider()

    const output = await provider.complete(
      { sessionId: 's1', message: 'hello', metadata: { source: 'test' } },
      { timeoutMs: 1000 }
    )

    assert.equal(output.answer, 'mock support answer')
    assert.equal(output.model, 'mock')
    assert.equal(output.route, 'mock')
    assert.deepEqual(output.usage, { inputTokens: 0, outputTokens: 0 })
  })
})

describe('OpenAICompatibleProvider', () => {
  let server: TestServer | undefined

  afterEach(async () => {
    if (server) {
      await server.close()
      server = undefined
    }
  })

  it('posts chat completions requests and parses the assistant answer', async () => {
    server = await startOpenAITestServer((req, res) => {
      assert.equal(req.url, '/chat/completions')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        id: 'chatcmpl-test',
        model: 'gpt-test',
        choices: [{ message: { role: 'assistant', content: 'provider answer' } }],
        usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 }
      }))
    })

    const provider = new OpenAICompatibleProvider({
      baseUrl: server.url,
      apiKey: 'fake-key',
      model: 'gpt-test',
      timeoutMs: 1000
    })

    const output = await provider.complete({ sessionId: 's1', message: 'hello' }, { timeoutMs: 1000 })

    assert.equal(output.answer, 'provider answer')
    assert.equal(output.model, 'gpt-test')
    assert.equal(output.route, 'openai-compatible')
    assert.deepEqual(output.usage, { inputTokens: 11, outputTokens: 7 })

    const request = server.requests[0] as { headers: Record<string, string>, body: { model: string, messages: Array<{ role: string, content: string }> } }
    assert.equal(request.headers.authorization, 'Bearer fake-key')
    assert.equal(request.body.model, 'gpt-test')
    assert.deepEqual(request.body.messages.at(-1), { role: 'user', content: 'hello' })
  })

  it('requires an API key', () => {
    assert.throws(
      () => new OpenAICompatibleProvider({ baseUrl: 'https://example.test/v1', apiKey: '', model: 'gpt-test', timeoutMs: 1000 }),
      /SUPPORT_AGENT_API_KEY is required/
    )
  })

  it('surfaces provider errors with status code context', async () => {
    server = await startOpenAITestServer((_req, res) => {
      res.writeHead(429, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'rate limited' } }))
    })

    const provider = new OpenAICompatibleProvider({
      baseUrl: server.url,
      apiKey: 'fake-key',
      model: 'gpt-test',
      timeoutMs: 1000
    })

    await assert.rejects(
      () => provider.complete({ sessionId: 's1', message: 'hello' }, { timeoutMs: 1000 }),
      /OpenAI-compatible provider failed with status 429: rate limited/
    )
  })
})
