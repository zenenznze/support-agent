# support-agent

`support-agent` 是一个新的专用客服后端项目。

它的目标不是复制现有 Hermes，也不是替代 OpenClaw 本体，而是把三类能力合在一条更适合客服场景的链路里：

- OpenClaw support 路线的速度：短链路、doc-only、少轮次、尽快给出能解决问题的答案。
- Hermes 的稳定性：会话记忆、持久化、工具纪律、审计和统计能力。
- pi-mono 的模块化思路：把 runtime、provider、agent loop、UI/adapter 拆开，后续更容易扩展。

当前仓库采用 build in public 的方式持续完善。

## 当前状态

项目处于早期规划和脚手架阶段。

已经有：

- MIT License
- 中文 README
- 完整开发计划
- 架构说明
- 本地/私有测试数据边界设计

还没有：

- 可用于生产的 HTTP 后端
- 完整 provider 接入
- 文档索引与检索实现
- 持久化 session/memory 实现
- chatbot-mvp 的正式集成

## 为什么做这个项目

前面对比发现，当前 Hermes 测试后端慢的主要原因不是模型慢，而是它通过 Node -> Python helper -> shell wrapper -> Hermes CLI 跑完整通用 agent 循环。每个问题会产生很多 messages 和工具调用，所以常见客服问题也容易跑到几十秒。

OpenClaw support 之所以快，是因为它更像专用 support runtime：更短的 doc-only 链路、更少工具/事件、更快收敛。

`support-agent` 的目标是：

1. 保留 OpenClaw support 的速度。
2. 补上 Hermes 那类记忆、审计、统计、稳定性能力。
3. 避免每次网页请求都启动完整 CLI agent。
4. 为后续客服质量评估、数据分析、灰度集成留接口。

## 设计目标

- 常见客服问题在 warmup 后尽量 5 秒内回复。
- 优先直接使用文档里的答案；文档没有明确答案时才补充说明。
- 默认限制 agent loop 和检索轮次，不让简单问题跑成复杂任务。
- 支持 session memory，但保持紧凑，不把大量历史塞进 prompt。
- 每次请求记录 trace，便于之后做审计、统计、延迟分析。
- 与现有 OpenClaw / chatbot-mvp 生产链路隔离，未验证前不接管 `/api/chat`。

## 参考项目

- pi-mono: https://github.com/badlogic/pi-mono
- Hermes Agent: https://github.com/nousresearch/hermes-agent
- OpenClaw: https://github.com/openclaw/openclaw

这些项目在创建本仓库时均核验为 MIT License。本仓库也采用 MIT License。

注意：目前只是架构参考，不直接复制大量代码。后续如果要移植某个文件或模块，需要先做文件级 license / provenance 审计。

## 文档

- 完整开发计划：`docs/development-plan.md`
- 架构说明：`docs/architecture.md`
- 本地/私有测试数据边界：`docs/local-private-data-policy.md`

## 公开仓库与本地数据边界

这个仓库会公开持续建设，但以下内容不会提交：

- `.env`、API key、token、真实服务配置
- 本地飞书/support docs 镜像
- 用户真实会话、session、trace、日志
- 本地 benchmark 原始输出
- 生产服务路径、内部数据导出
- 任何包含用户、业务或私有文档内容的测试材料

允许提交的是：

- 通用代码
- 空模板和 example 配置
- 脱敏后的 fixture
- 公开可复现的测试样例
- 设计文档、接口文档、开发计划

详细规则见 `docs/local-private-data-policy.md`。

## 计划中的目录结构

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
├── examples/
└── docs/
```

## 后续开发方式

后续会按开发计划逐步推进，并尽量保持：

1. 一个相对独立事项一个 commit。
2. 每个功能先写测试或最小验证方式。
3. 不把本地私有测试数据提交到仓库。
4. 每次性能相关改动都跑同一批评测问题做对照。
5. 未经明确确认，不改现有 OpenClaw 正式生产链路。

## License

MIT
