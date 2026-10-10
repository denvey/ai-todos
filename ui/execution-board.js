// Ported from Xinmo Desktop lib/execution-board.ts: task.state replaces workflowState,
// task.ai replaces runtimeForTask, and session.id replaces the provider/session key.
import { runtimeState } from '../src/runtime.js';
import { labels, runtimeLabel } from './format.js';

export const boardColumns = [
  { id: 'unstarted', label: '未开始', stages: ['defining', 'ready', 'changes_requested'], dropTarget: 'ready' },
  { id: 'executing', label: '进行中', stages: ['executing'], dropTarget: 'executing' },
  { id: 'waiting_user', label: '需要你处理', stages: ['waiting_user'], dropTarget: 'waiting_user' },
  { id: 'completed', label: '已完成', stages: ['completed'], dropTarget: 'completed' },
];
export function executionColumnForTask(task, runtime = task.ai) {
  if (task.state === 'cancelled') return 'cancelled';
  if (task.state === 'accepted') return 'completed';
  if (task.state === 'awaiting_acceptance') return 'waiting_user';
  if (runtime) {
    const state = runtimeState(runtime.state);
    if (runtime.mode === 'planning') {
      if (['waiting_approval', 'waiting_input'].includes(state)) return 'waiting_user';
      if (['queued', 'running'].includes(state)) return 'executing';
      if (['idle', 'completed'].includes(state) && task.state === 'defining') return 'waiting_user';
    }
    if (['queued', 'running'].includes(state)) return 'executing';
    if (['waiting_approval', 'waiting_input', 'failed'].includes(state)) return 'waiting_user';
    if (state === 'interrupted') return 'ready';
    if (['completed', 'idle', 'unknown'].includes(state) && task.state === 'executing') return 'waiting_user';
  }
  return task.state;
}
export function taskStatus(task) {
  const column = executionColumnForTask(task);
  if (column === 'cancelled') return labels.cancelled;
  if (column === 'completed') return '已完成';
  if (['defining', 'ready', 'changes_requested'].includes(column)) return labels[column];
  if (task.state === 'awaiting_acceptance') return labels.awaiting_acceptance;
  if (task.state === 'executing' && !task.sessionId) return '执行中';
  return runtimeLabel(task.ai) || labels[task.state];
}
export function executionColumnForSession(session) {
  const state = runtimeState(session.state);
  if (state === 'running' || state === 'queued') return 'executing';
  if (session.confirmedAt && ['idle', 'completed'].includes(state)) return 'completed';
  if (['waiting_input', 'waiting_approval', 'failed', 'idle', 'completed'].includes(state)) return 'waiting_user';
  return null;
}
export function canConfirmAiSession(session, tasks) {
  return executionColumnForSession(session) === 'waiting_user' && ['idle', 'completed'].includes(runtimeState(session.state))
    && !tasks.some(task => task.sessionId === session.id && task.state !== 'cancelled');
}
export function visibleExecutionSessions(sessions, tasks) {
  return sessions.filter(session => !tasks.some(task => {
    if (task.sessionId !== session.id || task.state === 'cancelled') return false;
    if (task.state === 'accepted') return ['idle', 'completed'].includes(runtimeState(session.state))
      && Date.parse(task.review?.at) >= Date.parse(session.observedAt);
    return true;
  }));
}
export function boardDropDecision(task, target) {
  const source = executionColumnForTask(task), runtime = runtimeState(task.ai?.state);
  if (task.sessionId && target === 'executing') return { reason: '请打开关联的 AI 会话继续执行' };
  if (task.sessionId && source === 'executing') return { reason: '请在原 AI 会话中中断或继续' };
  if (target === 'completed') return { reason: '不能通过拖拽制造完成或验收；请完成真实人工验收' };
  if (source === target) return { reason: '任务已经在这一列' };
  if (target === 'executing' && ['ready', 'changes_requested'].includes(source)) return { action: 'start' };
  if (source === 'waiting_user' && target === 'ready') {
    if (['waiting_approval', 'waiting_input'].includes(runtime)) return { reason: '请先处理 AI 的审批或输入请求，再决定是否退回修改' };
    if (task.state !== 'awaiting_acceptance') return { reason: '任务尚未明确提交验收，请先在原会话继续或提交交付结果' };
    return { action: 'request_changes' };
  }
  return { reason: '请通过任务详情推进当前阶段' };
}
