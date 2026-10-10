---
name: ai-todos
description: Open and manage the local ai-todos task, project, OKR, plan, focus and AI delivery workspace. Use when the user asks to use ai-todos.
---

# ai-todos

Use `ai_todos_open` to show the workspace. If the client does not render MCP Apps or expose its global/thread entry, open the returned `browserUrl` using the host's browser-opening tool. Do not create a sidebar section as a substitute for the app UI.

Use `ai_todos_snapshot` and `ai_todos_task` before mutations. Reuse an existing task specified by the user. Creation requires a UUID requestId generated once and reused on retries; the task ID is returned by the service. Revisions are mandatory and must come from the actual reviewed/read state. If a revision conflicts, explain the conflict and re-read for a new action; never upgrade an old human confirmation to the latest revision.

Inbox captures are separate from tasks. Archive/restore them with `update`; `promote` retains the original capture and can add the task to a date. Use `create_tasks` for an atomic batch with planDate. `daily_plan` requires every plan ID/revision read for the date and updates their combined membership; it keeps the existing plans. Batch operations return `{tasks}` or `{plans}`. Do not replace a stale plan selection with newer revisions without a fresh action.

For an AI task, bind the current trusted session ID only after it appears in the snapshot's official API-synced or hook-observed sessions; never infer IDs from task titles, timestamps, paths or arbitrary UUIDs. Check that the current trusted session matches the task's binding before execution. One active task uses one main session. Do not create duplicate tasks for another conversation.

Define the requirement and acceptance criteria, set the task ready, start execution, then perform the authorized work. Starting execution records intent; the runtime badge derives separately from official host status or trusted hooks; unloaded historical sessions have unknown status. Stop, interruption, a successful check, or silence never means delivery or acceptance. Submit only real delivery with a summary and evidence (HTTP(S) URL or local absolute path), including the actual check results and limitations. Do not claim checks you did not run.

There is no AI acceptance tool. After submission, point the user to the task's review page in the local application. Only the human's explicit decision on the displayed revision can accept or reject. Do not click acceptance checkboxes or submit review forms on the user's behalf without an explicit instruction to record the exact reviewed decision. Do not fabricate completion by dragging cards.

Unbound idle/ended conversations have a human-only “确认完成” button in the board. It records completion of the displayed conversation observation, independently of business task acceptance. New activity clears that confirmation. Never infer or record this decision from Stop or successful checks; linked tasks must use their existing delivery/review workflow.

The server and SQLite run locally without Xinmo, Gateway, OpenClaw or NAS. Browser notifications require an open panel and permission; reminders are persisted while the service runs. Focus uses wall-clock timestamps and continues over panel closure and service downtime until explicitly paused or finished.
