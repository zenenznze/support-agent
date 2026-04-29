# support-agent 完整开发计划

> For Hermes: 后续实现本计划时，使用 subagent-driven-development 或等价的逐任务开发方式推进；每个相对独立事项或阶段性进度完成后及时 commit/push；每次阶段完成后必须重新评估本计划并在必要时提交计划修订。任何集成都必须保持 OpenClaw 正式 8787 链路不受影响。

目标：构建一个新的专用客服后端 `support-agent`，把 OpenClaw support 的速度、Hermes 的记忆稳定性、pi-mono 的模块化 runtime/provider/agent 设计结合起来。

架构：从独立公开仓库开始，先做一个轻量 HTTP support runtime。核心是小而可控的 agent loop、预构建文档索引、紧凑 session memory、结构化 trace、可替换 provider，以及与现有 chatbot-mvp/OpenClaw 链路隔离的 adapter。

技术栈：TypeScript/Node.js 作为主 runtime；provider 层至少支持 mock、OpenAI-compatible Chat Completions、OpenAI Responses API、Anthropic Messages API；SQLite 或 JSONL 作为第一版本地持久化；Python 仅用于可选离线评测/数据处理脚本；MIT License。

---

## 0. 项目定位

`support-agent` 不是：

- 不是 Hermes 的 fork。
- 不是 OpenClaw 的替代品。
- 不是当前生产 `/api/chat` 的直接替换。
- 不是把本地私有 support docs 打包公开的仓库。

`support-agent` 是：

- 一个新的专用客服后端。
- 一个 build in public 的公开项目。
- 一个可接入不同 LLM provider 的轻量 support runtime。
- 一个保留 session memory、trace、统计、评测能力的客服 agent。
- 一个未来可以通过独立实验路由接入 chatbot-mvp 的后端。

## 1. 背景与根因

前面对比 OpenClaw support 与 Hermes 测试后端时，观察到：

- OpenClaw support 平均接口时延明显更低。
- Hermes 测试后端慢的主因不是模型，而是调用路径和 agent loop 太重。
- Hermes 测试后端路径近似为：Node -> Python helper -> shell wrapper -> Hermes CLI -> 完整 AIAgent 循环。
- Hermes 每题会产生较多 messages/tool calls/tool results，简单客服问题也可能多轮查证。
- OpenClaw support 更像专用 doc-only runtime，短链路、更少事件、更快收敛。

因此新项目的核心不是“换模型”，而是重做客服后端运行时：

1. 避免每次请求启动完整 CLI agent。
2. 避免无边界工具/文档探索。
3. 用预构建索引替代每次从零读文件。
4. 保留但压缩 memory。
5. 让 trace/stats 从第一天就存在。

## 2. 参考项目

### 2.1 pi-mono

URL: https://github.com/badlogic/pi-mono

参考方向：

- agent toolkit 的模块化拆分。
- provider / runtime / UI / adapter 分层。
- CLI、TUI、web UI、Slack bot 等多入口复用底层能力的思路。

使用原则：

- 先做架构审计，不直接复制代码。
- 如果后续直接依赖其 package，需要确认 package 边界、API 稳定性和 license headers。

### 2.2 Hermes Agent

URL: https://github.com/nousresearch/hermes-agent

参考方向：

- 会话持久化。
- memory 注入与用户偏好保存。
- tool 调用纪律。
- 轨迹、上下文、技能/文档能力。

使用原则：

- 借鉴稳定性和记忆设计，不复制完整 CLI agent loop。
- 客服后端要比 Hermes 更窄、更快、更可控。

### 2.3 OpenClaw

URL: https://github.com/openclaw/openclaw

参考方向：

- support route 的短链路。
- doc-only support agent 边界。
- gateway / session / history 的经验。
- 当前生产链路的速度和稳定性目标。

使用原则：

- 不改生产 8787。
- 未来只通过显式实验路由接入。
- 把 OpenClaw support 的“少轮次、短回答、文档优先”变成 support-agent 的默认策略。

## 3. 非协商约束

1. 未经明确确认，不替换 OpenClaw 正式 `/api/chat`。
2. 未经明确确认，不改 8787 正式服务。
3. 仓库公开，但本地私有测试数据不公开。
4. 常见请求目标：warmup 后不仅要尽快响应，还要尽量在 15 秒内完成完整回复；首段/可用响应目标 <= 10 秒，完整回答目标 <= 15 秒。模型 token 输出较慢时允许记录为尾延迟，但必须被 trace/stats 单独统计。
5. 性能比较目标：在相同题库、相同 provider/model 和相同网络条件下，support-agent 的 p50/p95 完整回答时延应至少优于 OpenClaw support baseline，同时保留回答质量。
6. 回答策略：文档有明确答案时，优先直接给文档内容；没有时才补充说明。
7. agent loop 必须有预算：最大 LLM 次数、最大检索次数、最大耗时。
8. trace、stats、session memory 要从早期就设计，不后补。
9. 每个开发事项或阶段性进度都要及时 commit。
10. 每完成一个阶段后，必须回看并必要时更新本总体计划；计划修订本身也要 commit。

## 4. 公开仓库与本地私有数据边界

详细规则见 `docs/local-private-data-policy.md`。

必须留在本地：

- `.env`、API key、token。
- 本地飞书文档镜像、support docs 私有快照。
- 真实用户聊天记录、session、trace、history。
- 本地 benchmark 原始输出。
- 内部路径、生产配置、真实服务日志。

可以公开：

- 通用代码。
- 空配置模板。
- 脱敏 fixture。
- 公开评测方法。
- 汇总指标。
- 架构文档和计划。

推荐本地目录：

```text
local-data/
├── docs-private/
├── sessions/
├── traces/
└── eval-datasets/
eval-output/
ops-output/
logs/
```

这些目录必须被 `.gitignore` 覆盖。

## 5. 目标架构

### 5.1 组件

```text
src/
├── server.ts                         # HTTP API 入口
├── config.ts                         # 环境变量与配置解析
├── agent/
│   ├── fast-support-agent.ts          # 有预算的客服 agent loop
│   ├── direct-hit.ts                  # 高频问题直答规则
│   └── types.ts
├── docs/
│   ├── loader.ts                      # 文档加载
│   ├── indexer.ts                     # 本地索引构建
│   ├── search.ts                      # 轻量检索
│   └── types.ts
├── providers/
│   ├── types.ts                       # provider 统一输入/输出与错误类型
│   ├── factory.ts                     # 根据配置创建 provider
│   ├── mock-provider.ts               # 测试 provider
│   ├── openai-compatible.ts           # OpenAI-compatible Chat Completions provider
│   ├── openai-responses.ts            # OpenAI Responses API provider
│   ├── anthropic-messages.ts          # Anthropic Messages API provider
│   └── conformance.ts                 # provider 输出归一化 / 一致性辅助
├── memory/
│   ├── session-store.ts               # session 存储接口
│   ├── jsonl-store.ts                 # 简单本地持久化
│   └── sqlite-store.ts                # 可选 SQLite 实现
├── tracing/
│   ├── trace-store.ts                 # trace 持久化
│   └── types.ts
├── stats/
│   └── latency-stats.ts               # 延迟统计
└── adapters/
    └── chatbot-bridge.ts              # 未来 chatbot-mvp adapter
```

### 5.2 请求流程

1. 收到 `/v1/chat` 请求。
2. 读取紧凑 session memory。
3. 分类：direct-hit / docs-needed / fallback。
4. direct-hit 命中时直接返回，不调用 LLM。
5. docs-needed 时检索 top 3 snippets。
6. 一次 LLM 调用生成回答。
7. 如证据不足，最多再检索/调用一次。
8. 返回 answer + traceId + latencyMs。
9. 异步或低成本写入 session、trace、stats。

### 5.3 性能预算

默认预算：

- direct-hit：0 次 LLM，目标 < 500ms，p95 保持亚秒级。
- 普通文档问答：默认 1 次 LLM；首段/可用响应目标 <= 10s，完整回答目标 <= 15s。
- 复杂问题：最多 2 次 LLM；首段/可用响应仍尽量 <= 10s，完整回答 hard target <= 15s，超过时要返回明确 fallback 或结构化超时错误。
- hard cap：默认不超过 2 次 LLM；只有评测/诊断模式才允许提高到 4 次。
- 文档检索 topK：3。
- 单请求线上 timeout：15s 级别，必须把 retrieval latency、provider first-token/first-chunk latency、full-completion latency 分开记录。
- quality replay timeout：与线上 fast gate 分开，可配置为 20-60s，用来评估答案质量，不作为生产 SLA。

### 5.4 API 草案

`GET /health`

响应：

```json
{
  "ok": true,
  "service": "support-agent",
  "version": "0.1.0"
}
```

`POST /v1/chat`

请求：

```json
{
  "sessionId": "web-123",
  "message": "pro 和 max 哪个更稳？",
  "metadata": {
    "source": "webchat"
  }
}
```

响应：

```json
{
  "ok": true,
  "sessionId": "web-123",
  "answer": "...",
  "traceId": "trace_...",
  "latencyMs": 1234,
  "route": "direct-hit"
}
```

`GET /v1/history/:sessionId`

返回脱敏/本地 session history，默认只本地可用或需要 admin token。

`GET /v1/admin/stats`

返回本地统计，默认只允许 localhost 或 admin token。

## 6. Milestone A: 公开仓库与文档基线

状态：当前正在完成。

目标：仓库公开，README 中文，完整计划入库，本地私有数据边界入库。

文件：

- 修改：`README.md`
- 修改：`.gitignore`
- 修改：`docs/development-plan.md`
- 创建：`docs/local-private-data-policy.md`

验证：

```bash
git status --short
git log --oneline --decorate -3
git ls-remote --heads origin main
curl -L -s -o /dev/null -w '%{http_code}\n' https://github.com/zenenznze/support-agent
curl -L -s -o /dev/null -w '%{http_code}\n' https://raw.githubusercontent.com/zenenznze/support-agent/main/README.md
```

Commit:

```bash
git commit -m "docs: prepare support-agent for build in public"
```

## 7. Milestone B: 参考项目审计

目标：弄清楚三个参考项目哪些只做概念参考，哪些可以作为依赖或移植对象。

文件：

- 创建：`docs/references/pi-mono-audit.md`
- 创建：`docs/references/hermes-agent-audit.md`
- 创建：`docs/references/openclaw-audit.md`
- 创建：`docs/references/design-decisions.md`

步骤：

1. shallow clone 三个参考项目到 `/home/ubuntu/reference-repos/`。
2. 记录 license、package 结构、核心 runtime/provider/memory/gateway 文件。
3. 找出可借鉴的接口边界。
4. 明确不复制的代码和原因。
5. 写设计决策文档。

验证：

```bash
test -s docs/references/pi-mono-audit.md
test -s docs/references/hermes-agent-audit.md
test -s docs/references/openclaw-audit.md
test -s docs/references/design-decisions.md
```

Commit:

```bash
git commit -m "docs: audit reference agent projects"
```

## 8. Milestone C: 最小 HTTP Runtime

目标：跑起来一个最小 HTTP 服务，提供 health 和 mock chat。

文件：

- 创建：`package.json`
- 创建：`tsconfig.json`
- 创建：`src/server.ts`
- 创建：`src/config.ts`
- 创建：`src/http/errors.ts`
- 创建：`tests/server.test.ts`

测试优先：

1. `/health` 返回 `ok: true`。
2. `/v1/chat` 在 mock 模式返回固定 answer、sessionId、traceId、latencyMs。
3. message 缺失时返回 400。

验证：

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

## 9. Milestone D: Provider 抽象

状态：Provider 抽象阶段已完成第一轮（mock + OpenAI-compatible Chat Completions，commit `2fb94db`；OpenAI Responses API，commit `20980e1`；Anthropic Messages API，commit `c9755ed`；provider conformance / response normalization，commit `6de11d9`）。下一步进入 Milestone E：文档索引与快速检索。

目标：建立统一 `ChatProvider` 抽象，支持多个 provider 协议，同时把 provider 输出归一到 support-agent 内部稳定格式。

已完成文件：

- 创建：`src/providers/types.ts`
- 创建：`src/providers/factory.ts`
- 创建：`src/providers/openai-compatible.ts`
- 创建：`src/providers/mock-provider.ts`
- 修改：`src/config.ts`
- 修改：`src/server.ts`
- 创建：`tests/providers.test.ts`

统一接口：

```ts
export interface ChatProvider {
  complete(input: ChatCompletionInput, options: CompletionOptions): Promise<ChatCompletionOutput>;
}
```

provider kind 路线：

```text
mock                         # 测试和默认本地开发
openai-compatible            # OpenAI-compatible Chat Completions；已完成第一版
openai-responses             # OpenAI Responses API；已完成第一版
anthropic-messages           # Anthropic Messages API；已完成第一版
```

环境变量路线：

```text
SUPPORT_AGENT_PROVIDER=mock|openai-compatible|openai-responses|anthropic-messages
SUPPORT_AGENT_PROVIDER_BASE_URL=
SUPPORT_AGENT_API_KEY=
SUPPORT_AGENT_MODEL=
SUPPORT_AGENT_TIMEOUT_MS=30000
```

### Milestone D1: OpenAI Responses API Provider

状态：已完成第一版，commit `20980e1`。已新增 `src/providers/openai-responses.ts`、`tests/providers-openai-responses.test.ts`，并接入 config/factory/type union。当前支持 `/responses` 请求、`output_text` 与 `output[].content[].text` 文本解析、usage 归一和基础错误处理。

目标：新增 OpenAI Responses API provider，并把其输出归一成 `ChatCompletionOutput`。

文件：

- 创建：`src/providers/openai-responses.ts`
- 修改：`src/providers/types.ts`
- 修改：`src/providers/factory.ts`
- 修改：`src/config.ts`
- 创建或扩展：`tests/providers-openai-responses.test.ts`

测试优先：

1. provider 向本地测试 HTTP server 发送 `/responses` 请求。
2. 请求包含 model、input 或等价 messages 转换结果。
3. 能解析 Responses API 的文本输出到 `answer`。
4. 能解析 usage 到统一 token usage。
5. HTTP 错误、空输出、timeout 返回清晰错误。

验证：

```bash
npm test
npm run build
npm audit --audit-level=moderate
```

Commit:

```bash
git commit -m "feat: add OpenAI Responses provider"
```

### Milestone D2: Anthropic Messages API Provider

状态：已完成第一版，commit `c9755ed`。已新增 `src/providers/anthropic-messages.ts`、`tests/providers-anthropic-messages.test.ts`，并接入 config/factory/type union。当前支持 `/v1/messages` 请求、`x-api-key` 与 `anthropic-version` header、文本 content block 解析、usage 归一、基础错误处理和 base URL `/v1` 去重。

目标：新增 Anthropic Messages API provider，并把 Claude/Anthropic 输出归一成 `ChatCompletionOutput`。

文件：

- 创建：`src/providers/anthropic-messages.ts`
- 修改：`src/providers/types.ts`
- 修改：`src/providers/factory.ts`
- 修改：`src/config.ts`
- 创建或扩展：`tests/providers-anthropic-messages.test.ts`

测试优先：

1. provider 向本地测试 HTTP server 发送 `/v1/messages` 请求。
2. 请求包含 `x-api-key`、`anthropic-version`、model、max_tokens、messages、session metadata。
3. 能解析 Anthropic content block 中的 text 到 `answer`。
4. 能解析 input/output token usage。
5. HTTP 错误、空 content、缺失 API key 返回清晰错误。

验证：

```bash
npm test
npm run build
npm audit --audit-level=moderate
```

Commit:

```bash
git commit -m "feat: add Anthropic Messages provider"
```

### Milestone D3: Provider Conformance / Response Normalization

状态：已完成第一版，commit `6de11d9`。已新增 `src/providers/conformance.ts` 和 `tests/providers-conformance.test.ts`，并让现有 provider 通过统一 output normalization 返回非空 answer/model/route 和数字 usage；同时新增 provider error safety 断言，确保错误包含 provider 上下文且不泄漏 fake key 或用户请求内容。

目标：保证不同 provider 的请求错误、空答案、usage、model、route 字段在 support-agent 内部一致，避免 fast agent loop 依赖各家 API 细节。

文件：

- 创建：`src/providers/conformance.ts`
- 创建：`tests/providers-conformance.test.ts`
- 修改：各 provider 测试，复用统一断言 fixture

验收：

- 所有 provider 都通过相同的 conformance 测试。
- 统一输出字段至少包含 `answer`、`model`、`route`、可选 `usage`。
- provider-specific 错误不泄漏密钥或完整请求体。
- fast-support-agent 只依赖统一 `ChatProvider` 接口。

Commit:

```bash
git commit -m "test: add provider conformance coverage"
```


## 10. Milestone E: 文档索引与快速检索

状态：已完成第一版，commit `cc79bab`。已新增公开 fixture docs、markdown loader、token indexer、search、build-doc-index 脚本和 `tests/docs-search.test.ts`；索引输出可写到 `/tmp` 或 ignored local-data 路径，不提交生成索引。

目标：用预构建索引替代每次请求里的文件探索。

文件：

- 创建：`src/docs/types.ts`
- 创建：`src/docs/loader.ts`
- 创建：`src/docs/indexer.ts`
- 创建：`src/docs/search.ts`
- 创建：`scripts/build-doc-index.ts`
- 创建：`tests/docs-search.test.ts`
- 创建：`tests/fixtures/public/docs/`

设计：

- 私有文档目录通过 `SUPPORT_AGENT_DOCS_DIR` 指定。
- repo 内只保留 public fixture。
- 索引输出默认写到 `local-data/indexes/` 或 `.data/indexes/`，不提交。
- 搜索返回 path/title/snippet/score。

验证：

```bash
npm test -- docs-search
npm run build-doc-index -- --docs tests/fixtures/public/docs --out /tmp/support-agent-index.json
```

Commit:

```bash
git commit -m "feat: add lightweight support doc index"
```

## 11. Milestone F: 高频问题 Direct-hit

状态：已完成（commit 9f53dd8）。

目标：常见确定性问题不进 LLM，直接返回稳定短答。

文件：

- 创建：`src/agent/direct-hit.ts`
- 创建：`src/agent/direct-hit-rules.ts`
- 创建：`tests/direct-hit.test.ts`

规则来源：

- 只放可公开的通用规则模板。
- 私有业务规则放本地配置或私有 docs，不提交真实内容。
- 如果要提交具体规则，必须确认它已公开且不含私有信息。

验证：

```bash
npm test -- direct-hit
```

Commit:

```bash
git commit -m "feat: add direct-hit support rules"
```

## 12. Milestone G: Fast Support Agent Loop

状态：已完成（commit 9f53dd8）。

目标：把 direct-hit、docs retrieval、provider、memory 组合成有预算的客服 agent。

文件：

- 创建：`src/agent/types.ts`
- 创建：`src/agent/fast-support-agent.ts`
- 创建：`src/prompts/support-system.ts`
- 创建：`tests/fast-support-agent.test.ts`

策略：

1. direct-hit 命中：直接返回。
2. 未命中：检索 top 3 snippets。
3. LLM 调用一次生成回答。
4. 如证据不足，最多追加一次检索/调用。
5. 默认 hard cap 2 次 LLM；配置允许最高 4。

验证：

```bash
npm test -- fast-support-agent
npm run build
```

Commit:

```bash
git commit -m "feat: implement bounded fast support agent"
```

## 13. Milestone H: Session Memory

目标：实现 Hermes 风格的稳定记忆，但保持轻量。

文件：

- 创建：`src/memory/types.ts`
- 创建：`src/memory/session-store.ts`
- 创建：`src/memory/jsonl-store.ts`
- 可选：`src/memory/sqlite-store.ts`
- 创建：`tests/session-store.test.ts`

记忆模型：

- 最近 6 条 turns。
- rolling summary。
- explicit support facts。
- 每次回答关联 traceId。

持久化路径：

- 默认：`local-data/sessions/`
- 不提交。

验证：

```bash
npm test -- session-store
npm run build
```

Commit:

```bash
git commit -m "feat: add persistent support sessions"
```

## 14. Milestone I: Trace / Stats / Audit

目标：从早期就支持延迟拆解和审计。

文件：

- 创建：`src/tracing/types.ts`
- 创建：`src/tracing/trace-store.ts`
- 创建：`src/stats/latency-stats.ts`
- 修改：`src/server.ts`
- 创建：`tests/tracing.test.ts`

记录字段：

- traceId
- sessionId
- route: direct-hit / retrieval / fallback
- total latency
- provider latency
- retrieval latency
- docs used
- token usage
- error class

默认输出：

- `local-data/traces/`
- `logs/`
- 不提交。

验证：

```bash
npm test -- tracing
curl -s http://127.0.0.1:8790/v1/admin/stats
```

Commit:

```bash
git commit -m "feat: add trace and latency statistics"
```

## 15. Milestone J: chatbot-mvp 隔离集成

目标：只添加实验路径，不影响正式 `/api/chat`。

support-agent 文件：

- 创建：`docs/integrations/chatbot-mvp.md`
- 创建：`examples/chatbot-mvp-env.example`

chatbot-mvp 后续单独任务：

- 添加 `/api/chat/support-agent` 或等价实验路由。
- 不改 `/api/chat` 默认指向。
- 不停止/替换 8787。

验证：

```bash
curl -s -X POST http://127.0.0.1:8790/v1/chat \
  -H 'content-type: application/json' \
  -d '{"sessionId":"test","message":"pro 和 max 哪个更稳？"}'
```

Commit:

```bash
git commit -m "docs: document chatbot-mvp support-agent integration"
```

## 16. Milestone K: 评测框架

目标：证明新后端在同一题库、同一 provider/model 和相同网络条件下，完整回答时延至少优于 OpenClaw support baseline，同时保留质量。评测必须同时统计“首段/可用响应”和“完整回答完成”，避免只看开始响应而忽略模型 token 输出尾延迟。

文件：

- 创建：`eval/replay-support-questions.ts`
- 创建：`eval/report.ts`
- 创建：`docs/evaluation.md`

公开/私有边界：

- 评测脚本可公开。
- 私有题库和原始输出放 `local-data/eval-datasets/`、`eval-output/`，不提交。
- 公开报告只放汇总指标或脱敏样例。

指标：

- OK rate
- first response latency（首段/可用响应），目标 <= 10s
- full completion latency（完整回答完成），目标 <= 15s
- avg / p50 / p95 latency，并与 OpenClaw support baseline 做同条件对比
- direct-hit rate
- provider first-token / first-chunk latency
- provider full-completion latency
- retrieval latency
- answer length
- timeout / fallback rate
- quality spot-check notes

验证：

```bash
npm run eval:support-questions
```

Commit:

```bash
git commit -m "test: add support question replay evaluation"
```

## 17. Milestone L: 安全与发布前检查

目标：保证公开仓库没有泄漏私有内容。

检查：

```bash
git status --short
git grep -n "API_KEY\|TOKEN\|SECRET\|BEGIN PRIVATE KEY" || true
git grep -n "feishu\|飞书\|session_\|trace_" || true
```

注意：出现 `feishu/飞书` 不一定都是泄漏，例如文档说明可保留；但真实文档内容、URL、token、cookie 不能保留。

可选后续添加：

- secret scanning pre-commit hook
- CI secret scan
- dependency audit
- lint/test workflow

Commit:

```bash
git commit -m "chore: add release safety checks"
```

## 18. 实施顺序建议

1. 先完成公开仓库文档基线。
2. 审计参考项目。
3. 做最小 HTTP runtime。
4. 做 provider 抽象和 mock。
5. 阶段复盘并更新本计划；把新增 provider 协议需求写回 roadmap。
6. 已补齐 OpenAI Responses API provider；继续补齐 Anthropic Messages API 与 provider conformance。
7. 做文档索引。
8. 做 direct-hit。
9. 做 fast agent loop。
10. 做 session memory。
11. 做 trace/stats。
12. 做 isolated chatbot-mvp 集成。
13. 做 benchmark replay。
14. 再考虑灰度切流。

后续每完成一个阶段都要重复：验证 -> commit/push -> 复盘总体计划 -> 必要时提交计划修订。

## 19. 完成标准

第一阶段完成标准：

- GitHub 仓库 public。
- README 中文。
- 完整开发计划在 `docs/development-plan.md`。
- 本地/私有测试数据边界在 `docs/local-private-data-policy.md`。
- `.gitignore` 覆盖所有本地运行/评测/私有数据目录。
- 远端 main 已推送。
- unauthenticated GitHub 页面和 raw README 可访问。

长期完成标准：

- 本地 HTTP runtime 可运行。
- provider 层至少支持 mock、OpenAI-compatible Chat Completions、OpenAI Responses API、Anthropic Messages API。
- 所有 provider 输出归一到稳定内部格式，并通过 conformance 测试。
- 常见 direct-hit 问题 p95 保持亚秒级。
- 普通文档检索问题首段/可用响应 <= 10 秒，完整回答 <= 15 秒。
- 在同一题库、同一 provider/model 和相同网络条件下，support-agent 的完整回答 p50/p95 至少优于 OpenClaw support baseline。
- session memory 稳定。
- trace/stats 可用于审计和优化，且能拆分 retrieval、provider first-token/first-chunk、provider full-completion、total full-completion。
- chatbot-mvp 通过隔离实验路由可调用。
- 未影响 OpenClaw 正式生产链路。
