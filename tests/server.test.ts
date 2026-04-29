import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { startServer, type SupportAgentServer } from '../src/server.js'

let server: SupportAgentServer | undefined

async function startTestServer() {
  server = await startServer({ port: 0 })
  return server
}

afterEach(async () => {
  if (server) {
    await server.close()
    server = undefined
  }
})

describe('support-agent HTTP runtime', () => {
  it('returns health metadata', async () => {
    const app = await startTestServer()

    const response = await fetch(`${app.url}/health`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(body, {
      ok: true,
      service: 'support-agent',
      version: '0.1.0'
    })
  })

  it('returns a mock chat response with trace and latency metadata', async () => {
    const app = await startTestServer()

    const response = await fetch(`${app.url}/v1/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'web-123', message: 'pro 和 max 哪个更稳？' })
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.ok, true)
    assert.equal(body.sessionId, 'web-123')
    assert.equal(body.answer, 'mock support answer')
    assert.equal(body.route, 'provider+mock')
    assert.equal(body.model, 'mock')
    assert.deepEqual(body.citations, [])
    assert.match(body.traceId, /^trace_[a-z0-9]+$/)
    assert.equal(typeof body.latencyMs, 'number')
    assert.ok(body.latencyMs >= 0)
    assert.equal(typeof body.latency, 'object')
    assert.equal(typeof body.latency.retrievalMs, 'number')
    assert.equal(typeof body.latency.providerMs, 'number')
    assert.equal(typeof body.latency.totalMs, 'number')
  })

  it('rejects chat requests without a message', async () => {
    const app = await startTestServer()

    const response = await fetch(`${app.url}/v1/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'web-123' })
    })
    const body = await response.json()

    assert.equal(response.status, 400)
    assert.deepEqual(body, {
      ok: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'message is required'
      }
    })
  })
})
