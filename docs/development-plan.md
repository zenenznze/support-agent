# support-agent Development Plan

> For Hermes: after this planning/setup task, use subagent-driven-development skill to implement the plan task-by-task. Keep OpenClaw production 8787 untouched.

Goal: Build a new private-first `support-agent` backend that combines OpenClaw support route speed with Hermes-style memory, session stability, and extensibility.

Architecture: Start as an isolated standalone repository and runtime. The first implementation should be a fast HTTP support backend with a small agent loop, bounded tool/doc retrieval, persistent conversation memory, structured traces, and adapter compatibility with existing chatbot bridge routes. It should learn from `badlogic/pi-mono` for modular agent/runtime/provider design, from `nousresearch/hermes-agent` for memory/session/tool reliability, and from `openclaw/openclaw` for fast doc-only support flow.

Tech Stack: TypeScript/Node.js for the HTTP runtime and adapters; optional Python only for offline indexing/evaluation scripts; OpenAI-compatible LLM API; SQLite or file-backed JSONL for first local persistence; MIT License.

---

## 0. Reference snapshot

Verified on 2026-04-25:

- `badlogic/pi-mono`
  - URL: `https://github.com/badlogic/pi-mono`
  - License: MIT
  - Description: AI agent toolkit: coding agent CLI, unified LLM API, TUI & web UI libraries, Slack bot, vLLM pods
- `nousresearch/hermes-agent`
  - URL: `https://github.com/nousresearch/hermes-agent`
  - License: MIT
  - Description: The agent that grows with you
- `openclaw/openclaw`
  - URL: `https://github.com/openclaw/openclaw`
  - License: MIT
  - Description: personal AI assistant / OpenClaw platform

Chosen project license: MIT, because all three references are MIT and the goal is open-source-compatible even though the initial repository is private.

## 1. Non-negotiable constraints

1. Do not modify or destabilize current OpenClaw production path.
2. Do not point existing `/api/chat` to the new backend until an explicit later cutover task.
3. Keep this project in its own repo and local folder:
   - `/home/ubuntu/support-agent`
   - `https://github.com/zenenznze/support-agent`
4. Treat referenced projects as references first. Do not copy substantial code before auditing exact license headers, APIs, and file-level provenance.
5. Optimize for common support requests replying within 5 seconds after warmup.
6. Preserve audit/statistics/analysis extensibility from day one.
7.客服回答策略：优先直接给出飞书/support docs 中能解决问题的内容；文档没有明确答案时才补充说明。

## 2. Target architecture

### 2.1 Components

- `src/server.ts`
  - Fast HTTP API.
  - Endpoints: `/health`, `/v1/chat`, `/v1/history/:sessionId`, `/v1/admin/stats`.
- `src/agent/fast-support-agent.ts`
  - Small bounded agent loop.
  - Default max doc reads: 3.
  - Default max LLM calls: 2 for common cases, hard cap 4.
- `src/providers/openai-compatible.ts`
  - OpenAI-compatible chat completion client.
  - Provider config via env.
- `src/docs/indexer.ts`
  - Build/search lightweight local doc index.
  - Start with manifest + keyword/BM25-like scoring; vector search optional later.
- `src/memory/session-store.ts`
  - Persistent sessions, user facts, recent conversation summary.
  - First version: SQLite preferred; JSONL fallback acceptable.
- `src/tracing/trace-store.ts`
  - Request-level trace events for audit and performance breakdown.
- `src/adapters/chatbot-bridge.ts`
  - Compatibility payloads for current chatbot-mvp bridge.
- `eval/`
  - Replay the existing support-vs-Hermes question set and compare latency/quality.
- `docs/`
  - Development plan, architecture notes, integration contract.

### 2.2 Runtime model

Request flow:

1. Receive chat message.
2. Load compact session memory.
3. Classify request:
   - direct-hit FAQ/hardline answer
   - doc retrieval needed
   - unsupported/needs fallback
4. Retrieve only the top small set of relevant docs/snippets.
5. Call LLM with compact prompt + snippets + memory.
6. Return short answer and trace metadata.
7. Persist session, trace, and stats asynchronously where safe.

### 2.3 Why this should be faster

- Avoid Hermes CLI cold path: no Node -> Python helper -> shell wrapper -> Hermes CLI chain.
- Avoid full general-purpose agent loop for every support message.
- Bound doc/tool reads.
- Use a prebuilt doc manifest/index instead of repeatedly discovering files.
- Keep memory compact and loaded directly, not via broad prompt/tool exploration.
- Preserve OpenClaw’s doc-only discipline for support answers.

## 3. Milestone plan

### Milestone A: Repository setup

Objective: Create the standalone private repository and initial project metadata.

Files:

- Create: `/home/ubuntu/support-agent/README.md`
- Create: `/home/ubuntu/support-agent/LICENSE`
- Create: `/home/ubuntu/support-agent/.gitignore`
- Create: `/home/ubuntu/support-agent/docs/development-plan.md`
- Create: `/home/ubuntu/support-agent/docs/architecture.md`

Steps:

1. Create `/home/ubuntu/support-agent`.
2. Add MIT license.
3. Add README that clearly states private-first support backend, not current production runtime.
4. Copy this development plan into `docs/development-plan.md`.
5. Initialize git, commit, create private GitHub repo `zenenznze/support-agent`, push `main`.
6. Verify remote URL and branch.

Expected verification:

```bash
cd /home/ubuntu/support-agent
git status --short
# expected: empty

git remote -v
# expected: origin https://github.com/zenenznze/support-agent.git

git ls-remote --heads origin main
# expected: one main branch commit
```

Commit:

```bash
git commit -m "chore: initialize support-agent repository"
```

### Milestone B: Reference project audit

Objective: Inspect the three reference projects enough to define what to reuse conceptually.

Files:

- Create: `docs/references/pi-mono-audit.md`
- Create: `docs/references/hermes-agent-audit.md`
- Create: `docs/references/openclaw-audit.md`
- Create: `docs/references/design-decisions.md`

Steps:

1. Clone or shallow inspect `badlogic/pi-mono` outside the repo, e.g. `/home/ubuntu/reference-repos/pi-mono`.
2. Inspect package layout, runtime abstractions, provider interfaces, examples.
3. Inspect `nousresearch/hermes-agent` memory/session/tool orchestration patterns.
4. Inspect `openclaw/openclaw` support/gateway/agent runtime patterns and current local OpenClaw support route.
5. Write audit docs with:
   - useful ideas
   - code we must not copy yet
   - API patterns worth adopting
   - license notes
6. Commit audit docs.

Verification:

```bash
test -s docs/references/pi-mono-audit.md
test -s docs/references/hermes-agent-audit.md
test -s docs/references/openclaw-audit.md
```

Commit:

```bash
git commit -m "docs: audit reference agent projects"
```

### Milestone C: Minimal HTTP runtime

Objective: Build a local server that starts quickly and exposes a stable API contract.

Files:

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/server.ts`
- Create: `src/config.ts`
- Create: `src/http/errors.ts`
- Create: `tests/server.test.ts`

Initial API:

- `GET /health`
- `POST /v1/chat`

Request example:

```json
{
  "sessionId": "web-123",
  "message": "pro 和 max 哪个更稳？",
  "metadata": { "source": "webchat" }
}
```

Response example:

```json
{
  "ok": true,
  "sessionId": "web-123",
  "answer": "...",
  "traceId": "...",
  "latencyMs": 1234
}
```

Steps:

1. Add TypeScript build/test tooling.
2. Write failing tests for `/health` and `/v1/chat` mock response.
3. Implement minimal server.
4. Run tests.
5. Commit.

Verification:

```bash
npm install
npm test
npm run build
npm run start:dev
curl -s http://127.0.0.1:8790/health
```

Commit:

```bash
git commit -m "feat: add minimal support-agent HTTP runtime"
```

### Milestone D: Provider abstraction

Objective: Add OpenAI-compatible provider with timeouts and request tracing.

Files:

- Create: `src/providers/types.ts`
- Create: `src/providers/openai-compatible.ts`
- Create: `src/providers/mock-provider.ts`
- Modify: `src/config.ts`
- Test: `tests/providers.test.ts`

Design:

```ts
export interface ChatProvider {
  complete(input: ChatCompletionInput, options: CompletionOptions): Promise<ChatCompletionOutput>;
}
```

Steps:

1. Write tests for provider selection and timeout config.
2. Implement mock provider.
3. Implement OpenAI-compatible provider using `fetch`.
4. Add env vars:
   - `SUPPORT_AGENT_PROVIDER_BASE_URL`
   - `SUPPORT_AGENT_API_KEY`
   - `SUPPORT_AGENT_MODEL`
   - `SUPPORT_AGENT_TIMEOUT_MS`
5. Commit.

Verification:

```bash
npm test -- providers
npm run build
```

Commit:

```bash
git commit -m "feat: add OpenAI-compatible provider abstraction"
```

### Milestone E: Doc index and fast retrieval

Objective: Replace repeated file/tool exploration with precomputed lightweight retrieval.

Files:

- Create: `src/docs/types.ts`
- Create: `src/docs/loader.ts`
- Create: `src/docs/indexer.ts`
- Create: `src/docs/search.ts`
- Create: `scripts/build-doc-index.ts`
- Test: `tests/docs-search.test.ts`

Design:

- Docs source is configured by env: `SUPPORT_AGENT_DOCS_DIR`.
- Build `data/doc-index.json` from markdown docs.
- Search returns top N snippets with path/title/score.
- Default top N: 3.

Steps:

1. Add fixture docs in `tests/fixtures/docs/`.
2. Write failing retrieval tests for known terms like `max`, `pro`, `兑换码`.
3. Implement loader and simple scorer.
4. Add build script.
5. Commit.

Verification:

```bash
npm test -- docs-search
npm run build-doc-index -- --docs tests/fixtures/docs --out /tmp/support-agent-index.json
```

Commit:

```bash
git commit -m "feat: add lightweight support doc index"
```

### Milestone F: Fast support agent loop

Objective: Implement bounded support flow with direct-hit path and docs-first answer generation.

Files:

- Create: `src/agent/types.ts`
- Create: `src/agent/direct-hit.ts`
- Create: `src/agent/fast-support-agent.ts`
- Create: `src/prompts/support-system.ts`
- Test: `tests/fast-support-agent.test.ts`

Policy:

1. If direct-hit rule matches, answer without LLM.
2. Else retrieve top 3 snippets.
3. Call LLM once with docs and compact memory.
4. If confidence/coverage insufficient, allow at most one extra retrieval/LLM call.
5. Hard cap total LLM calls at 2 by default; configurable hard cap 4.

Steps:

1. Write tests for direct-hit route returning in no-provider mode.
2. Write tests for retrieval + mock provider answer.
3. Implement loop budget enforcement.
4. Add trace events: classify, retrieve, complete.
5. Commit.

Verification:

```bash
npm test -- fast-support-agent
npm run build
```

Commit:

```bash
git commit -m "feat: implement bounded fast support agent"
```

### Milestone G: Memory and session stability

Objective: Add Hermes-inspired stable session memory without full Hermes CLI overhead.

Files:

- Create: `src/memory/types.ts`
- Create: `src/memory/session-store.ts`
- Create: `src/memory/jsonl-store.ts`
- Optional create: `src/memory/sqlite-store.ts`
- Test: `tests/session-store.test.ts`

Memory model:

- Recent turns: last 6 messages.
- Summary: compact rolling summary.
- User facts: explicit durable support facts only.
- Request trace link: traceId per answer.

Steps:

1. Write tests for create/read/update session.
2. Implement JSONL or SQLite store.
3. Wire store into `/v1/chat`.
4. Add idempotent session handling.
5. Commit.

Verification:

```bash
npm test -- session-store
npm run build
```

Commit:

```bash
git commit -m "feat: add persistent support sessions"
```

### Milestone H: Audit, stats, and observability

Objective: Ensure future audit/statistics/analysis needs are supported from day one.

Files:

- Create: `src/tracing/types.ts`
- Create: `src/tracing/trace-store.ts`
- Create: `src/stats/latency-stats.ts`
- Modify: `src/server.ts`
- Test: `tests/tracing.test.ts`

Data to record:

- traceId
- sessionId
- route
- total latency
- provider latency
- retrieval latency
- doc paths used
- direct-hit vs llm path
- token usage if provider returns it
- failure class if failed

Steps:

1. Write tests for trace persistence.
2. Implement trace store.
3. Add `/v1/admin/stats` local-only endpoint or token-gated endpoint.
4. Commit.

Verification:

```bash
npm test -- tracing
curl -s http://127.0.0.1:8790/v1/admin/stats
```

Commit:

```bash
git commit -m "feat: add trace and latency statistics"
```

### Milestone I: chatbot-mvp isolated integration

Objective: Integrate as a new experimental backend without touching production `/api/chat`.

Files in `support-agent`:

- Create: `docs/integrations/chatbot-mvp.md`
- Create: `examples/chatbot-mvp-env.example`

Files in chatbot-mvp only in a later explicit task:

- Add new route or env-configured backend target, e.g. `/api/chat/support-agent`.
- Do not change current `/api/chat` default.

Steps:

1. Define integration contract in docs.
2. Add example env vars:
   - `SUPPORT_AGENT_URL=http://127.0.0.1:8790`
   - `SUPPORT_AGENT_TIMEOUT_MS=30000`
3. In a separate task, add isolated bridge route and tests.
4. Commit support-agent docs first.

Verification:

```bash
curl -s -X POST http://127.0.0.1:8790/v1/chat \
  -H 'content-type: application/json' \
  -d '{"sessionId":"test","message":"pro 和 max 哪个更稳？"}'
```

Commit:

```bash
git commit -m "docs: document chatbot-mvp support-agent integration"
```

### Milestone J: Regression evaluation against existing support/Hermes benchmark

Objective: Prove the new backend is closer to OpenClaw speed while preserving quality.

Files:

- Create: `eval/replay-support-questions.ts`
- Create: `eval/report.ts`
- Create: `docs/evaluation.md`

Dataset sources:

- Existing comparison JSON:
  `/home/ubuntu/.openclaw/workspace/codesome-support-analysis/support-thread-crawl/ops/support-vs-hermes-compare-2026-04-24-20260424-104109.json`

Target metrics:

- Common requests under 5 seconds after warmup where direct-hit or high-confidence docs apply.
- Full benchmark average should be much closer to OpenClaw support than Hermes CLI backend.
- Zero production route changes during evaluation.

Steps:

1. Write replay tool.
2. Run support-agent against 19-question benchmark.
3. Compare with existing support/Hermes numbers.
4. Write report.
5. Commit.

Verification:

```bash
npm run eval:support-questions
```

Commit:

```bash
git commit -m "test: add support question replay evaluation"
```

## 4. Initial directory structure

```text
support-agent/
├── README.md
├── LICENSE
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts
│   ├── config.ts
│   ├── agent/
│   ├── docs/
│   ├── memory/
│   ├── providers/
│   ├── tracing/
│   └── stats/
├── tests/
├── eval/
├── scripts/
├── docs/
│   ├── development-plan.md
│   ├── architecture.md
│   ├── integrations/
│   └── references/
└── examples/
```

## 5. Open questions for later, not blockers now

1. Whether to implement the first persistence store as SQLite or JSONL. Recommendation: SQLite if dependency/setup is acceptable; JSONL if fastest minimal path is preferred.
2. Whether to use pi-mono packages directly or only mirror architectural ideas. Recommendation: audit first, then decide.
3. Whether this repo should remain private indefinitely or become public after sanitization. Current instruction: create private repo now, keep open-source-compatible license.
4. Exact deployment target and port. Recommendation: start local isolated port `8790`, no production route changes.

## 6. Definition of done for the first setup task

- `support-agent` private GitHub repository exists under `zenenznze`.
- `/home/ubuntu/support-agent` exists and is a git repo.
- `README.md`, `LICENSE`, `.gitignore`, and `docs/development-plan.md` exist.
- Initial commit pushed to remote `main`.
- Task result records any deviation.

## 7. Plan deviation policy

At the end of each task:

1. Compare completed work against this plan.
2. Record deviations in `result.md`.
3. Commit after each independent development item.
4. Do not archive task unless deliverables are actually complete and verified.
