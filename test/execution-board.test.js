import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeState, runtimeLabels, runtimeLabel, codexRuntimeState } from '../src/runtime.js';
import { executionColumnForTask, executionColumnForSession, taskStatus, canConfirmAiSession, visibleExecutionSessions, boardDropDecision } from '../ui/execution-board.js';
import { taskSessionPrompt } from '../ui/codex-prompts.js';

const task = (state, ai) => ({ id: 'task', state, sessionId: ai?.id, ai });
const runtime = state => ({ id: 'session', state, observedAt: '2026-10-10T00:00:00Z' });

test('task conversation context reuses the original task and waits for user input', () => {
  const prompt = taskSessionPrompt({ id: 'task', revision: 1, title: '原任务' });
  assert.match(prompt, /已有本会话关联时复用，不重复绑定/);
  assert.match(prompt, /等待用户继续，不自行开始执行/);
  const session = runtime('running');
  const bound = task('defining', { ...session, mode: 'planning' });
  assert.equal(executionColumnForTask(bound), 'executing');
  assert.equal(taskStatus(bound), '正在规划');
  assert.deepEqual(visibleExecutionSessions([session], [bound]), []);
  assert.deepEqual(visibleExecutionSessions([session], [{ ...bound, state: 'changes_requested' }]), []);
  assert.equal(executionColumnForTask({ ...bound, state: 'changes_requested' }), 'executing');
  assert.deepEqual(visibleExecutionSessions([session], [{ ...bound, state: 'awaiting_acceptance' }]), []);
  assert.deepEqual(visibleExecutionSessions([session], [{ ...bound, ai: null }]), []);
});

test('all Xinmo runtime states and planning labels retain their board meaning', () => {
  const expected = {
    queued: ['等待执行', 'executing'], running: ['正在执行', 'executing'],
    waiting_approval: ['等待审批', 'waiting_user'], waiting_input: ['等待输入', 'waiting_user'],
    interrupted: ['已中断', null], failed: ['执行失败', 'waiting_user'],
    completed: ['待确定', 'waiting_user'], idle: ['待确定', 'waiting_user'], unknown: ['状态未确认', null],
  };
  assert.deepEqual(Object.keys(runtimeLabels), Object.keys(expected));
  for (const [state, [label, column]] of Object.entries(expected)) {
    assert.equal(runtimeLabel(runtime(state)), label);
    assert.equal(executionColumnForSession(runtime(state)), column);
  }
  assert.equal(runtimeLabel({ state: 'queued', mode: 'planning' }), '等待规划');
  assert.equal(runtimeLabel({ state: 'running', mode: 'planning' }), '正在规划');
  assert.equal(runtimeLabel({ state: 'completed', mode: 'planning' }), '待确定');
  assert.equal(runtimeState('waiting'), 'waiting_approval');
  assert.equal(runtimeState('ended'), 'completed');
  assert.equal(codexRuntimeState({ type: 'active', activeFlags: ['waitingOnUserInput'] }), 'waiting_input');
  assert.equal(codexRuntimeState({ type: 'active', activeFlags: ['waitingOnApproval'] }), 'waiting_approval');
  assert.equal(codexRuntimeState({ type: 'systemError' }), 'failed');
  assert.equal(codexRuntimeState({ type: 'notLoaded' }), 'unknown');
});

test('Xinmo task stages combine business state and runtime instead of leaving stopped work executing', () => {
  for (const [state, column] of Object.entries({ defining: 'defining', ready: 'ready', executing: 'executing', awaiting_acceptance: 'waiting_user', changes_requested: 'changes_requested', accepted: 'completed', cancelled: 'cancelled' })) assert.equal(executionColumnForTask(task(state)), column);
  for (const state of ['waiting_input', 'waiting_approval', 'failed', 'idle', 'completed', 'unknown']) assert.equal(executionColumnForTask(task('executing', runtime(state))), 'waiting_user');
  assert.equal(executionColumnForTask(task('executing', runtime('interrupted'))), 'ready');
  assert.equal(executionColumnForTask(task('defining', runtime('running'))), 'executing');
  assert.equal(executionColumnForTask(task('defining', { ...runtime('idle'), mode: 'planning' })), 'waiting_user');
  assert.equal(taskStatus(task('executing', runtime('idle'))), '待确定');
  assert.equal(taskStatus(task('awaiting_acceptance', runtime('idle'))), '待我验收');
  assert.equal(taskStatus(task('accepted', runtime('running'))), '已完成');
  assert.equal(taskStatus(task('cancelled', runtime('running'))), '已取消');
});

test('confirmation, represented sessions and post-acceptance activity match Xinmo', () => {
  const ended = runtime('completed'), owner = task('executing', ended);
  assert.equal(canConfirmAiSession(ended, []), true);
  assert.equal(canConfirmAiSession(ended, [owner]), false);
  assert.deepEqual(visibleExecutionSessions([ended], [owner]), []);
  const accepted = { ...owner, state: 'accepted', review: { at: '2026-10-10T00:01:00Z' } };
  assert.deepEqual(visibleExecutionSessions([ended], [accepted]), []);
  const resumed = runtime('running');
  assert.deepEqual(visibleExecutionSessions([resumed], [accepted]), [resumed]);
  const newerEnd = { ...ended, observedAt: '2026-10-10T00:02:00Z' };
  assert.deepEqual(visibleExecutionSessions([newerEnd], [accepted]), [newerEnd]);
  assert.equal(canConfirmAiSession(newerEnd, [accepted]), false);
  const confirmed = { ...ended, confirmedAt: ended.observedAt };
  assert.equal(executionColumnForSession(confirmed), 'completed');
  assert.equal(canConfirmAiSession(confirmed, []), false);
  assert.equal(executionColumnForSession({ ...confirmed, state: 'running' }), 'executing');
  assert.deepEqual(boardDropDecision(task('awaiting_acceptance', ended), 'ready'), { action: 'request_changes' });
  assert.match(boardDropDecision(task('executing', runtime('waiting_input')), 'ready').reason, /审批或输入/);
  assert.match(boardDropDecision(owner, 'completed').reason, /不能通过拖拽/);
});
