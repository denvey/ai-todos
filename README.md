# Todos

English | [简体中文](README.zh-CN.md)

A local task and focus workspace for Codex. Organize tasks, projects, OKRs, and daily plans; track focus time and Codex chats; review AI deliveries before accepting them.

Todos runs its own local MCP service, web interface, and SQLite database. It does not require Xinmo Desktop, OpenClaw, a NAS, or a separate API key. Current release: **0.1.8**.

## Install in Codex

### Requirements

- A Codex CLI and desktop app with plugin support.
- Git and **Node.js 24 or later**.
- `node` and `codex` available on the PATH used to launch Codex.

### Install from GitHub

```sh
codex plugin marketplace add denvey/ai-todos
codex plugin add ai-todos@ai-todos
```

The repository includes a prebuilt plugin. You do not need npm or a build step to install it.

Both the plugin and its marketplace are named `ai-todos`. Codex requires an explicit marketplace selector, so use `ai-todos@ai-todos` (or `ai-todos --marketplace ai-todos`).

### Open the workspace

1. Start a new Codex chat after installation.
2. Ask Codex: **“Open the ai-todos workspace.”** This invokes `ai_todos_open`.
3. Use the plugin workspace if your client displays it. Otherwise, open the local `browserUrl` returned by the tool in the Codex browser or your regular browser.
4. To observe live AI activity through hooks, run `codex` in a terminal and use `/hooks` to review and trust the ai-todos hooks. Installing the plugin does not automatically trust them. Historical chat synchronization works without hooks.

The native sidebar entry and full-screen workspace have been confirmed in the maintainer's current desktop client. Availability can vary by client version; the local browser workspace provides the fallback. The sidebar name currently uses the static Chinese label **任务**.

### Update

```sh
codex plugin marketplace upgrade ai-todos
codex plugin add ai-todos@ai-todos
```

Start a new chat and reopen the workspace to load the update. Restart the desktop app if it still uses the old plugin, and review any changed hooks. A newer plugin client restarts an older local service while preserving stored tasks and focus records.

If you already registered a local marketplace with this name, use `codex plugin marketplace --help` to manage the existing source before adding the GitHub source.

## Use Todos

### 1. Capture and plan

- **Home:** type a task in the quick capture field. Press **Enter** to add it to today or **Option/Alt + Enter** to save it to the inbox.
- **Inbox:** keep ideas until you are ready to turn them into tasks. AI suggestions can refine or split a draft; review the suggestions before applying them.
- **Daily plans:** select existing tasks for a date and add notes. Removing a task from today's plan does not delete the task.

### 2. Define a task

Open **Tasks** and create or edit a task. Add a title, description, acceptance criteria, priority, project, schedule, and optional reminder or key result.

Use AI refinement to improve the draft, preview the suggestion, and apply it. Changes are only persisted when you save. AI refinement uses your configured Codex model and sends the draft and selected project metadata; it does not read project files or start task execution.

### 3. Work with Codex

Use the task's Codex action to open its linked chat or create and link a new chat. New chats use the project directory when available and prefill the task title, description, and acceptance criteria. **Send the prompt in Codex to continue**; creating a chat does not start a model turn.

The board groups work into **Not started**, **In progress**, **Needs your attention**, and **Done**, displaying task progress and observed AI activity separately. Historical chats with unknown activity appear in a collapsed section. Use Refresh to synchronize chats and projects.

For managed task delivery, follow this flow:

```text
Define requirements → Ready → Link a trusted chat → Start execution
                                                     ↓
                                      Submit a summary and evidence
                                                     ↓
                                          Human review
                                         ↙            ↘
                               Request changes       Accept
```

AI stopping, becoming idle, or ending a chat does not accept a task. Review submitted work through the local review page; acceptance requires an explicit human confirmation. Tasks with execution history, linked chats, or focus records are cancelled rather than deleted.

### 4. Track focus and progress

- Start, pause, resume, or end focus from Home or a task card. Only one task can be timed at a time.
- Focus records persist across page reloads and service restarts. **An active timer continues through sleep or closing Codex** until you pause or end it.
- Use the timeline to view or adjust schedules, Projects to organize work, and OKRs to track objectives and key results.

### 5. Choose your language and reminders

In **Settings**, choose **Automatic**, **简体中文**, or **English**. Switching takes effect immediately and is saved in the current browser or embedded panel. Automatic mode uses the Codex host language first, then the browser language, with English as the fallback. User-written content stays in its original language.

Configure task reminders, progress follow-up, daily review time, and time zone in Settings. Reminders are stored locally. Browser notifications require permission and an open page. The service does not wake AI or execute tasks in the background; scheduling pauses while the service is stopped or the machine is asleep.

## Run from source

For standalone use or development, install Node.js 24+ and npm, then run:

```sh
git clone https://github.com/denvey/ai-todos.git
cd ai-todos
npm ci
npm run package:plugin
npm run open
```

`npm run open` starts the local service and opens `http://127.0.0.1:16943`. The first workspace is empty. You can also use `npm start` to run the service in the foreground.

To install your local build into Codex:

```sh
codex plugin marketplace add /absolute/path/to/ai-todos
codex plugin add ai-todos@ai-todos
```

Local builds use the build machine's absolute Node path. Rebuild after moving to another machine or changing that path. Publication builds use `npm run package:plugin -- --portable` and require Node.js 24+ on PATH.

### MCP-only connection

If you only need MCP tools, configure the source entry directly:

```sh
codex mcp add ai-todos -- /absolute/path/to/node /absolute/path/to/ai-todos/src/mcp.ts
```

This requires the source dependencies installed with `npm ci`. MCP-only setup does not install the plugin skills or hooks. Choose either the full plugin or the MCP-only connection to avoid duplicate tools.

## Local data

Tasks, plans, reminders, and focus records are stored in `~/.ai-todos/ai-todos.sqlite`. The service listens only on `127.0.0.1`.

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `AI_TODOS_DATA_DIR` | `~/.ai-todos` | Shared data directory for the service, MCP, and hooks |
| `AI_TODOS_PORT` | `16943` | Local HTTP port; allowed range: 1024–65535 |

Use the same values for all plugin processes. Keep runtime credentials and logs out of Git.

To stop the service and back up data from a source checkout:

```sh
npm run stop
# Close Codex or ensure hooks have stopped writing before copying:
cp ~/.ai-todos/ai-todos.sqlite /your/backup/ai-todos.sqlite
```

Stop the service before restoring the database. Uninstalling the plugin does not delete the data directory or stop the independent service. This is a local, single-user application.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Plugin commands are unavailable | Confirm your Codex version supports plugins and start a new chat after installation. |
| `node` or `codex` cannot be found | Check the PATH inherited by Codex; Node.js must be version 24 or later. |
| The workspace is not displayed inside Codex | Open the `browserUrl` returned by `ai_todos_open`. |
| AI activity is unknown | Review and trust all eight ai-todos events with `/hooks`; reopen the chat you want to track. Historical chats may legitimately have unknown activity. |
| An update still shows the old interface | Refresh the marketplace, reinstall the plugin, start a new chat, and reopen the workspace. Restart Codex if needed. |
| The local port is occupied | Stop the conflicting service or choose another `AI_TODOS_PORT` consistently across the service, MCP, and hooks. |

## Development

```sh
npm run typecheck
npm run build
npm run check
npm run package:plugin -- --portable
```

The tests use temporary data directories. Source code is TypeScript; the installable plugin bundles JavaScript and its dependencies.

Internationalization uses `i18next` and `react-i18next` with bundled resources. To add a language, add a resource file under `src/locales/`, register it in `src/i18n.ts`, register the calendar locale in `ui/i18n.ts`, and include the corresponding Zod validation locale.

See the [Chinese user guide](README.zh-CN.md), [host support and verification records](docs/host-support.md), [UI component reuse](docs/ui-reuse.md), and [task/AI state mapping](docs/xinmo-status-port.md) for implementation details. These supporting documents are currently in Chinese.
