import { Store } from '../src/domain.js';
import { dbPath } from '../src/paths.js';
let input = '';
for await (const chunk of process.stdin) { input += chunk; if (input.length > 1000000) process.exit(0); }
try {
  const event = JSON.parse(input);
  if (event.agent_id || event.subagent_id) process.exit(0);
  const store = new Store(dbPath);
  try {
    const session = store.observe(event);
    let output = {};
    if (event.hook_event_name === 'SessionStart' || event.hook_event_name === 'UserPromptSubmit') {
      const task = store.all('task').find(task => task.sessionId === session.id && task.state !== 'cancelled');
      const context = task
        ? `已关联原任务 taskId=${task.id}。使用 ai-todos 技能，先调用 ai_todos_task 读取当前任务与验收标准，复用已有绑定；仅按用户请求推进。`
        : '可用 ai_todos_snapshot 查询后绑定原任务。';
      output = { hookSpecificOutput: { hookEventName: event.hook_event_name, additionalContext: `ai-todos 可信 Codex sessionId=${session.id}。${context}Stop 仅结束一轮，真实交付需证据，人验收需明确确认。` } };
    }
    process.stdout.write(JSON.stringify(output));
  } finally { store.close(); }
} catch (error) { process.stderr.write(`ai-todos hook: ${error.message}\n`); }
