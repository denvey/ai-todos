# Todos

English | [简体中文](README.zh-CN.md)

A task and focus workspace for Codex. Manage tasks, projects, OKRs, and daily plans, track focus time, and review AI deliveries in one place. Data is stored locally in SQLite.

## Why Todos?

When several Codex tasks run in parallel, you have to switch between chats to check their status. There is no single view of which chats are running, waiting for input, or ready for review.

Todos brings chat activity and task progress together on one board, so you can see what needs your attention without opening each chat. When activity cannot be observed, it is shown as unknown.

## Install

Requires a Codex CLI and desktop app with plugin support, Git, and **Node.js 24+**. Make sure `node` and `codex` are available on Codex's PATH.

```sh
codex plugin marketplace add denvey/ai-todos
codex plugin add ai-todos@ai-todos
```

The plugin is prebuilt; no npm install or compilation is needed.

Start a new Codex chat and ask **“Open the ai-todos workspace.”** If your client does not display the workspace, open the local `browserUrl` returned by the tool.

To track live AI activity, run `codex` in a terminal and use `/hooks` to review and trust the ai-todos hooks. Historical chat synchronization works without hooks.

## Update

```sh
codex plugin marketplace upgrade ai-todos
codex plugin add ai-todos@ai-todos
```

Start a new chat and reopen the workspace. Restart Codex if the old interface remains loaded.

## Use

- **Home:** capture tasks and plan your day. Press Enter to add a task to today, or Option/Alt + Enter to save it to the inbox.
- **Inbox:** collect ideas, preview AI suggestions, and turn ideas into tasks.
- **Tasks:** define requirements and acceptance criteria, set priorities and schedules, and track progress on the board or timeline.
- **Codex chats:** open a task's linked chat or create one with task details prefilled. Send the prompt in Codex when you are ready to continue.
- **Projects and OKRs:** organize tasks by project and track objectives and key results.
- **Focus:** start, pause, resume, and end a timer. An active timer keeps running through sleep or closing Codex until you pause or end it.
- **Review:** inspect the delivery summary and evidence, then accept or request changes. AI stopping does not automatically complete or accept a task.
- **Settings:** choose Automatic, 简体中文, or English, and configure reminders and time zone. Language changes apply immediately; your content stays in its original language.

Browser notifications require permission and an open page. Reminders pause while the service is stopped or the machine is asleep; they do not trigger AI execution.

## Run from source

Requires Node.js 24+ and npm.

```sh
git clone https://github.com/denvey/ai-todos.git
cd ai-todos
npm ci
npm run package:plugin
npm run open
```

This starts the local service and opens `http://127.0.0.1:16943`. The first workspace is empty. Run `npm run stop` from the checkout to stop the service.

## Local data

The database is stored at `~/.ai-todos/ai-todos.sqlite`. The service listens only on `127.0.0.1`. Uninstalling the plugin does not delete your data or stop the service.

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_TODOS_DATA_DIR` | `~/.ai-todos` | Data directory |
| `AI_TODOS_PORT` | `16943` | Local HTTP port |

Use the same settings for the service, MCP, and hooks. Stop the service and ensure hooks have stopped writing before backing up or restoring the database.
