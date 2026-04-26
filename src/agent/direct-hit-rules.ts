import type { DirectHitResult } from './types.js'

export interface DirectHitRule {
  intent: string
  patterns: RegExp[]
  answer: string
}

export const DIRECT_HIT_RULES: DirectHitRule[] = [
  {
    intent: 'password-reset',
    patterns: [
      /重置.*密码/i,
      /密码.*重置/i,
      /忘记.*密码/i,
      /登录不上/i,
      /reset.*password/i,
      /forgot.*password/i,
      /cannot\s+log\s+in/i,
      /can't\s+log\s+in/i
    ],
    answer: '可以在登录页面点击“忘记密码 / Reset password”发起重置密码。请先确认邮箱地址正确；如果没有收到重置邮件，请检查垃圾邮件，并确认工作区域名是否正确。'
  },
  {
    intent: 'invoice-download',
    patterns: [
      /发票.*下载/i,
      /下载.*发票/i,
      /invoice.*download/i,
      /download.*invoice/i,
      /where.*invoice/i
    ],
    answer: 'You can download invoices from workspace billing settings. If the invoice is tied to a failed payment, update the card and retry the invoice payment from billing settings.'
  },
  {
    intent: 'failed-payment',
    patterns: [
      /付款.*失败/i,
      /支付.*失败/i,
      /failed\s+payment/i,
      /payment\s+failed/i,
      /card.*declined/i
    ],
    answer: 'For failed payments, update the payment card in workspace billing settings, then retry the invoice payment. If it still fails, share the workspace ID and payment timestamp with support.'
  }
]

export function toDirectHit(rule: DirectHitRule): DirectHitResult {
  return {
    answer: rule.answer,
    route: 'direct-hit',
    intent: rule.intent,
    model: 'direct-hit-rules',
    citations: []
  }
}
