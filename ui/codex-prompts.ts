import type { Task } from '../src/types.ts';

export function executionPrompt(task: Pick<Task, 'id' | 'title' | 'sessionId'>) {
  return `使用 ai-todos 执行原任务 ${task.id}「${task.title}」。先调用 ai_todos_task 阅读当前任务与验收标准，并保留实际读取的 revision。${task.sessionId ? `此任务绑定 Codex sessionId=${task.sessionId}；必须与本会话可信 hook 提供的 sessionId 核对，一致才能执行，不一致时停止并让用户打开原会话。` : '先从本会话可信 hook 获取 sessionId，并查询 ai_todos_snapshot 中已观察的会话后绑定；不得猜测 ID，不要重复建任务。'}按定义 → 就绪 → 开始执行推进。真实交付后用 submit 提交摘要和实际证据，不能虚报测试结果。Stop 只代表本轮结束。请提示用户在本地应用审阅证据，AI 不得自行验收。`;
}

export function taskSessionPrompt(task: Pick<Task, 'title' | 'description' | 'criteria'>) {
  return [task.title, task.description.trim() && `任务内容：\n${task.description.trim()}`, task.criteria.trim() && `验收标准：\n${task.criteria.trim()}`].filter(Boolean).join('\n\n');
}
