import { i18n } from '../src/i18n.ts';
import type { TranslationKey } from '../src/i18n.ts';
// Ported from Xinmo Desktop lib/execution-board.ts: task.state replaces workflowState,
// task.ai replaces runtimeForTask, and session.id replaces the provider/session key.
import type { Task, LiveSession } from '../src/types.ts';
import { runtimeState } from '../src/runtime.ts';
import { labels, runtimeLabel } from './format.ts';

export const boardColumns: { id: string; label: TranslationKey; stages: string[]; dropTarget: string }[] = [
  { id: 'unstarted', label: "board.unstarted", stages: ['defining', 'ready', 'changes_requested'], dropTarget: 'ready' },
  { id: 'executing', label: "board.executing", stages: ['executing'], dropTarget: 'executing' },
  { id: 'waiting_user', label: "board.waitingUser", stages: ['waiting_user'], dropTarget: 'waiting_user' },
  { id: 'completed', label: "board.completed", stages: ['completed'], dropTarget: 'completed' },
];
export function executionColumnForTask(task: Pick<Task, 'state' | 'ai'>, runtime = task.ai) {
  if (task.state === 'cancelled') return 'cancelled';
  if (task.state === 'accepted') return 'completed';
  if (task.state === 'awaiting_acceptance') return 'waiting_user';
  if (runtime) {
    const state = runtimeState(runtime.state);
    if (runtime.mode === 'planning') {
      if (['waiting_approval', 'waiting_input'].includes(state)) return 'waiting_user';
      if (['queued', 'running'].includes(state)) return 'executing';
      if (['idle', 'completed'].includes(state) && task.state === 'defining' && (runtime.turnId || runtime.event === 'Stop')) return 'waiting_user';
    }
    if (['queued', 'running'].includes(state)) return 'executing';
    if (['waiting_approval', 'waiting_input', 'failed'].includes(state)) return 'waiting_user';
    if (['idle', 'completed'].includes(state) && (runtime.turnId || runtime.event === 'Stop')) return 'waiting_user';
    if (state === 'interrupted') return 'ready';
    if (['completed', 'idle', 'unknown'].includes(state) && task.state === 'executing') return 'waiting_user';
  }
  return task.state;
}
export function taskStatus(task: Pick<Task, 'state' | 'ai' | 'sessionId'>) {
  const column = executionColumnForTask(task);
  if (column === 'cancelled') return i18n.t(labels.cancelled);
  if (column === 'completed') return i18n.t('board.completed');
  if (task.state !== 'awaiting_acceptance' && task.sessionId && ['idle', 'completed'].includes(runtimeState(task.ai?.state))) return i18n.t('task.pendingCompletion');
  if (runtimeState(task.ai?.state) === 'interrupted') return runtimeLabel(task.ai);
  if (['defining', 'ready', 'changes_requested'].includes(column)) return i18n.t(labels[column]);
  if (task.state === 'awaiting_acceptance') return i18n.t(labels.awaiting_acceptance);
  if (task.state === 'executing' && !task.sessionId) return i18n.t('state.manualExecuting');
  return runtimeLabel(task.ai) || i18n.t(labels[task.state]);
}
export function taskNextStep(task: Pick<Task, 'state' | 'ai' | 'sessionId'>): { action: 'complete' | 'review' | 'session'; label: TranslationKey; hint: TranslationKey } | null {
  if (['accepted', 'cancelled'].includes(task.state)) return null;
  if (task.state === 'awaiting_acceptance') return { action: 'review', label: 'review.action', hint: 'task.nextReview' };
  const runtime = runtimeState(task.ai?.state);
  if (task.sessionId && ['queued', 'running', 'waiting_approval', 'waiting_input', 'failed', 'interrupted'].includes(runtime)) {
    if (runtime === 'waiting_approval') return { action: 'session', label: 'task.handleApproval', hint: 'task.nextApproval' };
    if (runtime === 'waiting_input') return { action: 'session', label: 'task.reply', hint: 'task.nextInput' };
    if (runtime === 'failed' || runtime === 'interrupted') return { action: 'session', label: 'task.resumeSession', hint: 'task.nextResume' };
    return { action: 'session', label: 'task.viewProgress', hint: 'task.nextRunning' };
  }
  return { action: 'complete', label: 'session.confirm', hint: 'task.nextComplete' };
}
export function executionColumnForSession(session: Pick<LiveSession, 'state' | 'confirmedAt'>) {
  const state = runtimeState(session.state);
  if (state === 'running' || state === 'queued') return 'executing';
  if (session.confirmedAt && ['idle', 'completed'].includes(state)) return 'completed';
  if (['waiting_input', 'waiting_approval', 'failed', 'idle', 'completed'].includes(state)) return 'waiting_user';
  return null;
}
export function canConfirmAiSession(session: Pick<LiveSession, 'id' | 'state' | 'confirmedAt'>, tasks: Pick<Task, 'sessionId' | 'state'>[]) {
  return executionColumnForSession(session) === 'waiting_user' && ['idle', 'completed'].includes(runtimeState(session.state))
    && !tasks.some(task => task.sessionId === session.id && task.state !== 'cancelled');
}
export function visibleExecutionSessions(sessions: LiveSession[], tasks: Task[]) {
  return sessions.filter(session => !tasks.some(task => {
    if (task.sessionId !== session.id || task.state === 'cancelled') return false;
    if (task.state === 'accepted') return ['idle', 'completed'].includes(runtimeState(session.state))
      && Date.parse(task.review?.at ?? '') >= Date.parse(session.observedAt);
    return true;
  }));
}
export function boardDropDecision(task: Pick<Task, 'state' | 'ai' | 'sessionId'>, target: string): { action?: 'start' | 'request_changes'; reason?: string } {
  const source = executionColumnForTask(task), runtime = runtimeState(task.ai?.state);
  if (task.sessionId && target === 'executing') return { reason: i18n.t("board.resumeLinked") };
  if (task.sessionId && source === 'executing') return { reason: i18n.t("board.interruptLinked") };
  if (target === 'completed') return { reason: i18n.t("board.noDragAccept") };
  if (source === target) return { reason: i18n.t("board.sameColumn") };
  if (target === 'executing' && ['ready', 'changes_requested'].includes(source)) return { action: 'start' };
  if (source === 'waiting_user' && target === 'ready') {
    if (['waiting_approval', 'waiting_input'].includes(runtime)) return { reason: i18n.t("board.resolveRequest") };
    if (task.state !== 'awaiting_acceptance') return { reason: i18n.t("board.submitFirst") };
    return { action: 'request_changes' };
  }
  return { reason: i18n.t("board.useDetails") };
}
