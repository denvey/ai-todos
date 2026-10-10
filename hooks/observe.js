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
    const output = event.hook_event_name === 'SessionStart' || event.hook_event_name === 'UserPromptSubmit'
      ? { hookSpecificOutput: { hookEventName: event.hook_event_name, additionalContext: `ai-todos 可信 Codex sessionId=${session.id}。可用 ai_todos_snapshot 查询后绑定原任务；Stop 仅结束一轮，真实交付需证据，人验收需明确确认。` } }
      : {};
    process.stdout.write(JSON.stringify(output));
  } finally { store.close(); }
} catch (error) { process.stderr.write(`ai-todos hook: ${error.message}\n`); }
