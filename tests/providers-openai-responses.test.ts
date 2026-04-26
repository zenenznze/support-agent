import assert from 'node:assert/strict'
import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import { afterEach, describe, it } from 'node:test'
import { loadConfig } from '../src/config.js'
import { createProvider } from '../src/providers/factory.js'
import { OpenAIResponsesProvider } from '../src/providers/openai-responses.js'

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

async function startResponsesTestServer(handler: (req: IncomingMessage, res: ServerResponse, body: unknown, requests: unknown[]) => void | Promise<void>): Promise<TestServer> {
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

describe('OpenAI Responses provider configuration', () => {
  it('loads openai-responses environment variables and creates the provider from factory', () => {
    const config = loadConfig({
      SUPPORT_AGENT_PROVIDER: 'openai-responses',
      SUPPORT_AGENT_PROVIDER_BASE_URL: 'https://example.test/v1',
      SUPPORT_AGENT_API_KEY: 'fake-key',
      SUPPORT_AGENT_MODEL: 'gpt-responses-test',
      SUPPORT_AGENT_TIMEOUT_MS: '23456'
    })

    assert.equal(config.provider.kind, 'openai-responses')
    assert.equal(config.provider.baseUrl, 'https://example.test/v1')
    assert.equal(config.provider.apiKey, 'fake-key')
    assert.equal(config.provider.model, 'gpt-responses-test')
    assert.equal(config.provider.timeoutMs, 23456)
    assert.ok(createProvider(config.provider) instanceof OpenAIResponsesProvider)
  })
})

describe('OpenAIResponsesProvider', () => {
  let server: TestServer | undefined

  afterEach(async () => {
    if (server) {
      await server.close()
      server = undefined
    }
  })

  it('posts Responses API requests and parses output text with usage', async () => {
    server = await startResponsesTestServer((req, res) => {
      assert.equal(req.method, 'POST')
      assert.equal(req.url, '/responses')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        id: 'resp_test',
        model: 'gpt-responses-test',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'output_text', text: 'responses provider answer' }
            ]
          }
        ],
        usage: { input_tokens: 13, output_tokens: 8, total_tokens: 21 }
      }))
    })

    const provider = new OpenAIResponsesProvider({
      baseUrl: server.url,
      apiKey: 'fake-key',
      model: 'gpt-responses-test',
      timeoutMs: 1000
    })

    const output = await provider.complete({ sessionId: 's1', message: 'hello responses', metadata: { channel: 'test' } }, { timeoutMs: 1000 })

    assert.equal(output.answer, 'responses provider answer')
    assert.equal(output.model, 'gpt-responses-test')
    assert.equal(output.route, 'openai-responses')
    assert.deepEqual(output.usage, { inputTokens: 13, outputTokens: 8 })

    const request = server.requests[0] as { headers: Record<string, string>, body: { model: string, input: string, metadata: unknown } }
    assert.equal(request.headers.authorization, 'Bearer fake-key')
    assert.equal(request.headers['content-type'], 'application/json')
    assert.equal(request.body.model, 'gpt-responses-test')
    assert.equal(request.body.input, 'hello responses')
    assert.deepEqual(request.body.metadata, { channel: 'test' })
  })

  it('parses the output_text convenience field when present', async () => {
    server = await startResponsesTestServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        model: 'gpt-responses-test',
        output_text: 'convenience answer',
        usage: { input_tokens: 1, output_tokens: 2 }
      }))
    })

    const provider = new OpenAIResponsesProvider({
      baseUrl: server.url,
      apiKey: 'fake-key',
      model: 'gpt-responses-test',
      timeoutMs: 1000
    })

    const output = await provider.complete({ sessionId: 's1', message: 'hello' }, { timeoutMs: 1000 })

    assert.equal(output.answer, 'convenience answer')
    assert.deepEqual(output.usage, { inputTokens: 1, outputTokens: 2 })
  })

  it('requires an API key', () => {
    assert.throws(
      () => new OpenAIResponsesProvider({ baseUrl: 'https://example.test/v1', apiKey: '', model: 'gpt-test', timeoutMs: 1000 }),
      /SUPPORT_AGENT_API_KEY is required/
    )
  })

  it('surfaces provider errors with status code context without leaking request data', async () => {
    server = await startResponsesTestServer((_req, res) => {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'bad response input' } }))
    })

    const provider = new OpenAIResponsesProvider({
      baseUrl: server.url,
      apiKey: 'fake-key',
      model: 'gpt-responses-test',
      timeoutMs: 1000
    })

    await assert.rejects(
      () => provider.complete({ sessionId: 's1', message: 'secret user content' }, { timeoutMs: 1000 }),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /OpenAI Responses provider failed with status 400: bad response input/)
        assert.doesNotMatch(error.message, /fake-key/)
        assert.doesNotMatch(error.message, /secret user content/)
        return true
      }
    )
  })

  it('rejects empty Responses API output', async () => {
    server = await startResponsesTestServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ model: 'gpt-responses-test', output: [] }))
    })

    const provider = new OpenAIResponsesProvider({
      baseUrl: server.url,
      apiKey: 'fake-key',
      model: 'gpt-responses-test',
      timeoutMs: 1000
    })

    await assert.rejects(
      () => provider.complete({ sessionId: 's1', message: 'hello' }, { timeoutMs: 1000 }),
      /OpenAI Responses provider returned an empty assistant message/
    )
  })
})
