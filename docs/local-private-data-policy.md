# 本地与私有测试数据边界

`support-agent` 采用 build in public，但客服后端开发会天然接触本地文档、真实会话、评测输出和服务配置。这个文档定义哪些内容可以进入公开仓库，哪些必须留在本地。

## 原则

1. 公开仓库只放通用代码、通用文档、脱敏样例和可复现的空模板。
2. 本地真实数据、内部文档镜像、真实用户会话、日志、trace、token 一律不提交。
3. 所有本地测试目录默认被 `.gitignore` 拦截。
4. 如果需要公开测试样例，必须先脱敏，并确认不包含真实用户、订单、账号、文档原文或内部路径。
5. 公开 benchmark 报告只能放汇总指标；原始私有问答内容和完整模型输出默认不公开。

## 可以提交

- `src/` 下的通用实现代码。
- `tests/fixtures/public/` 下的人工编造或完全脱敏 fixture。
- `examples/*.example`、`.env.example` 等模板。
- `docs/` 下的架构、计划、接口、公开评测说明。
- `eval/` 下的评测脚本，但不能包含私有数据集。
- 只包含字段结构、不含真实内容的 mock JSON。

## 不可以提交

- `.env`、`.env.local`、任何真实 API key / token。
- 本地飞书文档镜像、support docs 私有快照。
- 真实用户聊天记录、session、trace、history。
- 生产服务配置、systemd 实例配置、cloudflared 真实隧道配置。
- 本地 benchmark 原始输出、逐题真实答案、未脱敏模型回复。
- 包含内部绝对路径和业务数据的导出文件。
- `data/`、`.data/`、`local-data/`、`ops-output/`、`eval-output/` 等运行产物。

## 推荐本地目录布局

这些目录可以在本地存在，但不进入 git：

```text
support-agent/
├── local-data/
│   ├── docs-private/          # 私有 support docs / 飞书镜像
│   ├── sessions/              # 本地 session 存储
│   ├── traces/                # 本地 trace 存储
│   └── eval-datasets/         # 私有评测数据集
├── eval-output/               # 本地评测输出
├── ops-output/                # 运维脚本输出
├── logs/                      # 本地日志
└── .env.local                 # 本地开发配置
```

## 公开 fixture 规则

如果要把测试样例提交到仓库，放在：

```text
tests/fixtures/public/
```

要求：

1. 内容必须是人工编造或彻底脱敏。
2. 不包含真实客服文档原文。
3. 不包含真实用户提问、账号、订单、支付信息。
4. 不包含内部服务地址、隧道地址、token、cookie。
5. 文件名不要暴露内部项目名或客户名。

## 私有评测规则

评测脚本可以公开，评测数据和原始输出默认不公开。

推荐：

- 公开：`eval/replay-support-questions.ts`
- 公开：`docs/evaluation.md` 中的评测方法和汇总指标
- 不公开：`local-data/eval-datasets/*.json`
- 不公开：`eval-output/*.jsonl`

如果未来要公开某次评测结果，只提交汇总表，例如：

- 平均延迟
- P50/P95
- 成功率
- direct-hit 命中率
- 平均 provider latency
- 平均 retrieval latency

不要提交逐题原文和完整回答，除非确认它们是人工构造的公开 fixture。

## `.gitignore` 必须覆盖的类别

- env/secrets
- runtime data
- local/private docs
- sessions/traces/history
- logs
- eval outputs
- temporary caches
- package/build outputs

提交前必须运行：

```bash
git status --short
git diff --cached --name-only
```

确认没有私有文件被 staged。

## 后续实现要求

1. 所有读取私有 docs 的路径都必须通过环境变量配置，例如 `SUPPORT_AGENT_DOCS_DIR`。
2. 默认 repo 内只提供 `examples/` 和公开 fixture，不内置私有文档。
3. trace/session 默认写入被忽略的本地目录，例如 `local-data/traces/`。
4. 如果新增脚本会生成输出，默认输出到 `ops-output/` 或 `eval-output/`。
5. CI 只能使用公开 fixture，不能依赖本地私有数据。
