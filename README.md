# support-agent

Private-first, open-source-compatible support backend prototype.

`support-agent` is intended to become a faster dedicated support backend that combines:

- OpenClaw-style fast doc-only support routing.
- Hermes-style stable sessions, memory, auditability, and tool discipline.
- pi-mono-inspired modular agent/runtime/provider design.

This repository starts private. It uses the MIT License so it can remain open-source-ready if/when it is later sanitized and published.

## Current status

Initial planning/setup only. No production traffic should be routed here yet.

## Reference projects

- https://github.com/badlogic/pi-mono
- https://github.com/nousresearch/hermes-agent
- https://github.com/openclaw/openclaw

All three references were checked as MIT-licensed at setup time.

## Goals

- Common support requests should eventually respond within 5 seconds after warmup.
- Keep support answers docs-first: use support docs directly when they contain the answer.
- Maintain persistent sessions and compact memory without paying the overhead of a full CLI agent run per request.
- Preserve audit/statistics/analysis hooks from the first real implementation.

## Non-goals for initial setup

- Do not replace OpenClaw production `/api/chat`.
- Do not modify the current 8787 production service.
- Do not copy substantial code from reference projects before a file-level audit.

## Plan

See `docs/development-plan.md`.
