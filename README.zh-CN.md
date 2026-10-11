# Todos · 任务

[English](README.md) | 简体中文

面向 Codex 的任务与专注工作台。在一个地方管理任务、项目、OKR 和每日计划，记录专注时间，审阅 AI 交付。数据通过 SQLite 保存在本地。

## 为什么需要 Todos？

并行执行多个 Codex 任务时，需要在不同会话之间来回切换，逐个查看状态。缺少一个统一视图，无法一眼看到哪些会话正在运行、等待输入，哪些结果需要审阅。

Todos 将会话状态和任务进度集中到一个看板，方便你查看全局进展，找到需要处理的事项，无需逐个打开会话。无法观察到的运行状态会标为未知。

## 安装

需要支持插件的 Codex CLI 和桌面端、Git，以及 **Node.js 24+**。确保 Codex 启动环境的 PATH 能找到 `node` 和 `codex`。

```sh
codex plugin marketplace add denvey/ai-todos
codex plugin add ai-todos@ai-todos
```

插件已预构建，安装无需运行 npm 或编译。

安装后开启新会话，输入 **“打开 ai-todos 工作台”**。如果客户端没有显示工作台，打开工具返回的本地 `browserUrl`。

如需观察 AI 实时运行状态，在终端运行 `codex`，通过 `/hooks` 审阅并信任 ai-todos 的 hooks。历史会话同步不需要 hooks。

## 更新

```sh
codex plugin marketplace upgrade ai-todos
codex plugin add ai-todos@ai-todos
```

更新后开启新会话并重新打开工作台。若仍加载旧界面，重启 Codex。

## 使用

- **首页**：快捷录入任务并安排今天。Enter 加入今天，Option/Alt + Enter 存入收件箱。
- **收件箱**：收集想法，预览 AI 整理建议，再转为任务。
- **任务**：填写需求和验收标准，设置优先级与排期，通过看板或时间线跟踪进展。
- **Codex 会话**：打开任务关联的会话，或创建预填任务信息的新会话。准备好后，在 Codex 中发送提示继续工作。
- **项目与 OKR**：按项目组织任务，跟踪目标和关键结果。
- **专注**：开始、暂停、恢复或结束计时。运行中的计时会持续到你暂停或结束，包括设备休眠或关闭 Codex 的时间。
- **审阅**：查看交付摘要和证据，人工验收或退回修改。AI 停止不等于任务完成或验收通过。
- **设置**：选择跟随系统、简体中文或 English，并配置提醒与时区。语言切换立即生效，用户内容保留原文。

浏览器通知需要授权且页面保持打开。服务停止或设备休眠期间暂停提醒调度；提醒不会自动执行 AI 任务。

## 从源码运行

需要 Node.js 24+ 和 npm。

```sh
git clone https://github.com/denvey/ai-todos.git
cd ai-todos
npm ci
npm run package:plugin
npm run open
```

启动本地服务并打开 `http://127.0.0.1:16943`。首次打开为空工作台。在源码目录运行 `npm run stop` 可停止服务。

## 本地数据

数据库位于 `~/.ai-todos/ai-todos.sqlite`。服务仅监听 `127.0.0.1`。卸载插件不会删除数据，也不会停止服务。

| 环境变量 | 默认值 | 用途 |
| --- | --- | --- |
| `AI_TODOS_DATA_DIR` | `~/.ai-todos` | 数据目录 |
| `AI_TODOS_PORT` | `16943` | 本地 HTTP 端口 |

服务、MCP 和 hooks 应使用相同配置。备份或恢复数据库前，先停止服务并确保 hooks 已停止写入。
