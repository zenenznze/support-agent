import assert from 'node:assert/strict'
import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import { afterEach, describe, it } from 'node:test'
import { AnthropicMessagesProvider } from '../src/providers/anthropic-messages.js'
import { assertProviderErrorSafe, normalizeProviderOutput } from '../src/providers/conformance.js'
import { MockProvider } from '../src/providers/mock-provider.js'
import { OpenAICompatibleProvider } from '../src/providers/openai-compatible.js'
import { OpenAIResponsesProvider } from '../src/providers/openai-responses.js'
import type { ChatCompletionOutput, ProviderKind } from '../src/providers/types.js'

interface TestServer {
  url: string
  close: () => Promise<void>
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

async function startTestServer(handler: (req: IncomingMessage, res: ServerResponse, body: unknown) => void | Promise<void>): Promise<TestServer> {
  const server = http.createServer(async (req, res) => {
    const body = await readJson(req)
    await handler(req, res, body)
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
    close: () => new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
  }
}

function assertConformantOutput(output: ChatCompletionOutput, route: ProviderKind): void {
  assert.equal(typeof output.answer, 'string')
  assert.notEqual(output.answer.trim(), '')
  assert.equal(output.answer, output.answer.trim())
  assert.equal(typeof output.model, 'string')
  assert.notEqual(output.model.trim(), '')
  assert.equal(output.model, output.model.trim())
  assert.equal(output.route, route)

  if (output.usage) {
    assert.equal(typeof output.usage.inputTokens, 'number')
    assert.equal(typeof output.usage.outputTokens, 'number')
    assert.ok(Number.isFinite(output.usage.inputTokens))
    assert.ok(Number.isFinite(output.usage.outputTokens))
    assert.ok(output.usage.inputTokens >= 0)
    assert.ok(output.usage.outputTokens >= 0)
  }
}

describe('provider output conformance', () => {
  let server: TestServer | undefined

  afterEach(async () => {
    if (server) {
      await server.close()
      server = undefined
    }
  })

  it('normalizes successful outputs to non-empty answer, model, route, and numeric usage', () => {
    const output: ChatCompletionOutput = normalizeProviderOutput('Conformance test', {
      answer: '  normalized answer  ',
      model: '  test-model  ',
      route: 'mock' as const,
      usage: {}
    })

    assert.deepEqual(output, {
      answer: 'normalized answer',
      model: 'test-model',
      route: 'mock',
      usage: {
        inputTokens: 0,
        outputTokens: 0
      }
    })
    assertConformantOutput(output, 'mock')
  })

  it('rejects empty normalized answers with provider context', () => {
    assert.throws(
      () => normalizeProviderOutput('Conformance test', { answer: '   ', model: 'test-model', route: 'mock' }),
      /Conformance test provider returned an empty assistant message/
    )
  })

  it('keeps provider errors useful while asserting they do not leak secrets or user request content', () => {
    const error = new Error('OpenAI Responses provider failed with status 429: rate limited')
    assertProviderErrorSafe(error, {
      providerName: 'OpenAI Responses',
      forbiddenSubstrings: ['fake-key', 'secret user content']
    })
  })

  it('accepts all current providers through the same output contract', async () => {
    const mock = new MockProvider()
    assertConformantOutput(await mock.complete({ sessionId: 's1', message: 'hello' }, { timeoutMs: 1000 }), 'mock')

    server = await startTestServer((req, res) => {
      if (req.url === '/chat/completions') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({
          model: 'chat-model',
          choices: [{ message: { content: ' chat answer ' } }],
          usage: { prompt_tokens: 3, completion_tokens: 4 }
        }))
        return
      }

      if (req.url === '/responses') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({
          model: 'responses-model',
          output_text: ' responses answer ',
          usage: {}
        }))
        return
      }

      if (req.url === '/v1/messages') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({
          model: 'anthropic-model',
          content: [{ type: 'text', text: ' anthropic answer ' }],
          usage: {}
        }))
        return
      }

      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: `unexpected path ${req.url}` } }))
    })

    const openaiCompatible = new OpenAICompatibleProvider({
      baseUrl: server.url,
      apiKey: 'fake-key',
      model: 'chat-model',
      timeoutMs: 1000
    })
    assertConformantOutput(await openaiCompatible.complete({ sessionId: 's1', message: 'hello' }, { timeoutMs: 1000 }), 'openai-compatible')

    const openaiResponses = new OpenAIResponsesProvider({
      baseUrl: server.url,
      apiKey: 'fake-key',
      model: 'responses-model',
      timeoutMs: 1000
    })
    assertConformantOutput(await openaiResponses.complete({ sessionId: 's1', message: 'hello' }, { timeoutMs: 1000 }), 'openai-responses')

    const anthropicMessages = new AnthropicMessagesProvider({
      baseUrl: server.url,
      apiKey: 'fake-key',
      model: 'anthropic-model',
      timeoutMs: 1000
    })
    assertConformantOutput(await anthropicMessages.complete({ sessionId: 's1', message: 'hello' }, { timeoutMs: 1000 }), 'anthropic-messages')
  })

  it('applies the same safe error contract to provider HTTP failures', async () => {
    server = await startTestServer((_req, res) => {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'provider unavailable' } }))
    })

    const providers = [
      {
        name: 'OpenAI-compatible',
        complete: () => new OpenAICompatibleProvider({ baseUrl: server!.url, apiKey: 'fake-key', model: 'chat-model', timeoutMs: 1000 })
          .complete({ sessionId: 's1', message: 'secret user content' }, { timeoutMs: 1000 })
      },
      {
        name: 'OpenAI Responses',
        complete: () => new OpenAIResponsesProvider({ baseUrl: server!.url, apiKey: 'fake-key', model: 'responses-model', timeoutMs: 1000 })
          .complete({ sessionId: 's1', message: 'secret user content' }, { timeoutMs: 1000 })
      },
      {
        name: 'Anthropic Messages',
        complete: () => new AnthropicMessagesProvider({ baseUrl: server!.url, apiKey: 'fake-key', model: 'anthropic-model', timeoutMs: 1000 })
          .complete({ sessionId: 's1', message: 'secret user content' }, { timeoutMs: 1000 })
      }
    ]

    for (const provider of providers) {
      await assert.rejects(
        provider.complete,
        (error: unknown) => {
          assertProviderErrorSafe(error, {
            providerName: provider.name,
            forbiddenSubstrings: ['fake-key', 'secret user content']
          })
          assert.match((error as Error).message, /status 500: provider unavailable/)
          return true
        }
      )
    }
  })
})
