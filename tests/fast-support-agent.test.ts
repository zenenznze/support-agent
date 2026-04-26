import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildDocIndex } from '../src/docs/indexer.js'
import { runFastSupportAgent } from '../src/agent/fast-support-agent.js'
import type { ChatProvider } from '../src/providers/types.js'

function countingProvider(answer = 'provider synthesized answer', requireDocsContext = true) {
  let calls = 0
  const provider: ChatProvider = {
    async complete(input, options) {
      calls += 1
      assert.ok(options.timeoutMs <= 2500)
      if (requireDocsContext) {
        assert.match(input.message, /Support docs context/)
      }
      return {
        answer,
        model: 'test-model',
        route: 'mock',
        usage: { inputTokens: 12, outputTokens: 6 }
      }
    }
  }

  return {
    provider,
    calls: () => calls
  }
}

const docIndex = buildDocIndex([
  {
    path: 'account-login.md',
    title: 'Account login troubleshooting',
    content: 'If a user cannot log in, first ask them to verify their email address and reset the password from the public login page.'
  },
  {
    path: 'billing/invoices.md',
    title: 'Billing invoice help',
    content: 'Users can download invoices from workspace billing settings.'
  }
], '2026-04-26T00:00:00.000Z')

describe('fast support agent loop', () => {
  it('short-circuits high-confidence direct hits', async () => {
    const counted = countingProvider()
    const result = await runFastSupportAgent(
      { sessionId: 's1', message: '怎么重置密码？' },
      { provider: counted.provider, providerTimeoutMs: 30000, docIndex }
    )

    assert.equal(result.route, 'direct-hit')
    assert.equal(result.intent, 'password-reset')
    assert.equal(result.model, 'direct-hit-rules')
    assert.equal(counted.calls(), 0)
    assert.deepEqual(result.citations, [])
  })

  it('retrieves docs and bounds the provider call for non-direct questions', async () => {
    const counted = countingProvider('Use billing settings to download invoices.')
    const result = await runFastSupportAgent(
      { sessionId: 's2', message: 'How do billing settings work for receipts?' },
      { provider: counted.provider, providerTimeoutMs: 30000, maxProviderTimeoutMs: 2500, docIndex }
    )

    assert.equal(result.route, 'retrieval+mock')
    assert.equal(result.answer, 'Use billing settings to download invoices.')
    assert.equal(result.model, 'test-model')
    assert.equal(counted.calls(), 1)
    assert.equal(result.citations?.[0]?.path, 'billing/invoices.md')
  })

  it('falls back to provider route when no docs match', async () => {
    const counted = countingProvider('Please share more detail so we can help.', false)
    const result = await runFastSupportAgent(
      { sessionId: 's3', message: 'Tell me about unsupported custom widgets' },
      { provider: counted.provider, providerTimeoutMs: 1200 }
    )

    assert.equal(result.route, 'provider+mock')
    assert.equal(counted.calls(), 1)
    assert.deepEqual(result.citations, [])
  })
})
