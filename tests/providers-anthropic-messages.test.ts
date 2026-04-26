import assert from 'node:assert/strict'
import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import { afterEach, describe, it } from 'node:test'
import { loadConfig } from '../src/config.js'
import { createProvider } from '../src/providers/factory.js'
import { AnthropicMessagesProvider } from '../src/providers/anthropic-messages.js'

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

async function startAnthropicTestServer(handler: (req: IncomingMessage, res: ServerResponse, body: unknown, requests: unknown[]) => void | Promise<void>): Promise<TestServer> {
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

describe('Anthropic Messages provider configuration', () => {
  it('loads anthropic-messages environment variables and creates the provider from factory', () => {
    const config = loadConfig({
      SUPPORT_AGENT_PROVIDER: 'anthropic-messages',
      SUPPORT_AGENT_PROVIDER_BASE_URL: 'https://anthropic.example.test',
      SUPPORT_AGENT_API_KEY: 'fake-key',
      SUPPORT_AGENT_MODEL: 'claude-test',
      SUPPORT_AGENT_TIMEOUT_MS: '34567'
    })

    assert.equal(config.provider.kind, 'anthropic-messages')
    assert.equal(config.provider.baseUrl, 'https://anthropic.example.test')
    assert.equal(config.provider.apiKey, 'fake-key')
    assert.equal(config.provider.model, 'claude-test')
    assert.equal(config.provider.timeoutMs, 34567)
    assert.ok(createProvider(config.provider) instanceof AnthropicMessagesProvider)
  })
})

describe('AnthropicMessagesProvider', () => {
  let server: TestServer | undefined

  afterEach(async () => {
    if (server) {
      await server.close()
      server = undefined
    }
  })

  it('posts Messages API requests and parses text content with usage', async () => {
    server = await startAnthropicTestServer((req, res) => {
      assert.equal(req.method, 'POST')
      assert.equal(req.url, '/v1/messages')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        id: 'msg_test',
        model: 'claude-test',
        role: 'assistant',
        content: [
          { type: 'text', text: 'anthropic provider answer' }
        ],
        usage: { input_tokens: 17, output_tokens: 9 }
      }))
    })

    const provider = new AnthropicMessagesProvider({
      baseUrl: server.url,
      apiKey: 'fake-key',
      model: 'claude-test',
      timeoutMs: 1000
    })

    const output = await provider.complete({ sessionId: 's1', message: 'hello anthropic' }, { timeoutMs: 1000 })

    assert.equal(output.answer, 'anthropic provider answer')
    assert.equal(output.model, 'claude-test')
    assert.equal(output.route, 'anthropic-messages')
    assert.deepEqual(output.usage, { inputTokens: 17, outputTokens: 9 })

    const request = server.requests[0] as { headers: Record<string, string>, body: { model: string, max_tokens: number, messages: Array<{ role: string, content: string }>, metadata: { user_id: string } } }
    assert.equal(request.headers['x-api-key'], 'fake-key')
    assert.equal(request.headers['anthropic-version'], '2023-06-01')
    assert.equal(request.headers['content-type'], 'application/json')
    assert.equal(request.body.model, 'claude-test')
    assert.equal(request.body.max_tokens, 1024)
    assert.deepEqual(request.body.messages, [{ role: 'user', content: 'hello anthropic' }])
    assert.deepEqual(request.body.metadata, { user_id: 's1' })
  })

  it('uses /v1/messages exactly once when the base URL already includes /v1', async () => {
    server = await startAnthropicTestServer((req, res) => {
      assert.equal(req.url, '/v1/messages')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        model: 'claude-test',
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 1 }
      }))
    })

    const provider = new AnthropicMessagesProvider({
      baseUrl: `${server.url}/v1`,
      apiKey: 'fake-key',
      model: 'claude-test',
      timeoutMs: 1000
    })

    const output = await provider.complete({ sessionId: 's1', message: 'hello' }, { timeoutMs: 1000 })
    assert.equal(output.answer, 'ok')
  })

  it('requires an API key', () => {
    assert.throws(
      () => new AnthropicMessagesProvider({ baseUrl: 'https://api.anthropic.com', apiKey: '', model: 'claude-test', timeoutMs: 1000 }),
      /SUPPORT_AGENT_API_KEY is required/
    )
  })

  it('surfaces provider errors with status code context without leaking request data', async () => {
    server = await startAnthropicTestServer((_req, res) => {
      res.writeHead(429, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'rate limited' } }))
    })

    const provider = new AnthropicMessagesProvider({
      baseUrl: server.url,
      apiKey: 'fake-key',
      model: 'claude-test',
      timeoutMs: 1000
    })

    await assert.rejects(
      () => provider.complete({ sessionId: 's1', message: 'secret user content' }, { timeoutMs: 1000 }),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /Anthropic Messages provider failed with status 429: rate limited/)
        assert.doesNotMatch(error.message, /fake-key/)
        assert.doesNotMatch(error.message, /secret user content/)
        return true
      }
    )
  })

  it('rejects empty Messages API content', async () => {
    server = await startAnthropicTestServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ model: 'claude-test', content: [] }))
    })

    const provider = new AnthropicMessagesProvider({
      baseUrl: server.url,
      apiKey: 'fake-key',
      model: 'claude-test',
      timeoutMs: 1000
    })

    await assert.rejects(
      () => provider.complete({ sessionId: 's1', message: 'hello' }, { timeoutMs: 1000 }),
      /Anthropic Messages provider returned an empty assistant message/
    )
  })
})
