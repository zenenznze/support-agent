import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findDirectHit } from '../src/agent/direct-hit.js'


describe('direct-hit support rules', () => {
  it('answers password reset requests without a provider call', () => {
    const hit = findDirectHit('怎么重置密码？登录不上去了')

    assert.equal(hit?.route, 'direct-hit')
    assert.equal(hit?.intent, 'password-reset')
    assert.match(hit?.answer ?? '', /重置密码/)
    assert.match(hit?.answer ?? '', /登录页面/)
    assert.deepEqual(hit?.citations, [])
  })

  it('answers invoice download requests without a provider call', () => {
    const hit = findDirectHit('Where can I download my invoice?')

    assert.equal(hit?.intent, 'invoice-download')
    assert.match(hit?.answer ?? '', /billing settings/i)
  })

  it('returns undefined when no high-confidence rule matches', () => {
    assert.equal(findDirectHit('pro 和 max 哪个更适合团队？'), undefined)
  })
})
