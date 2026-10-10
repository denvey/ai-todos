import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store, commandSchema } from '../src/domain.ts';

test('human session confirmation checks the displayed version and binding, and clears on activity', t => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-todos-confirm-'));
  let now = Date.parse('2026-10-10T00:00:00Z');
  const s = new Store(join(dir, 'data.sqlite'), () => now);
  t.after(() => { s.close(); rmSync(dir, { recursive: true, force: true }); });
  const id = randomUUID();
  const observe = (event, turn = 'turn-1') => { now++; return s.observe({ session_id: id, cwd: '/tmp/project', hook_event_name: event, turn_id: turn }); };
  const input = () => {
    const session = s.sessions()[0];
    return { id, observedAt: session.observedAt, event: session.event, turnId: session.turnId ?? null, catalogUpdatedAt: session.catalogUpdatedAt ?? null, confirmed: true };
  };
  assert.throws(() => s.confirmSession({ id: randomUUID(), observedAt: s.at(), event: 'Stop', turnId: null, catalogUpdatedAt: null, confirmed: true }), /会话不存在/);
  observe('UserPromptSubmit');
  assert.throws(() => s.confirmSession(input()), /只有/);
  observe('Stop');
  const stale = input();
  observe('UserPromptSubmit', 'turn-2'); observe('Stop', 'turn-2');
  assert.throws(() => s.confirmSession(stale), /会话已变化/);
  const current = input(), confirmed = s.confirmSession(current);
  assert.ok(confirmed.confirmedAt);
  assert.equal(s.confirmSession(current).confirmedAt, confirmed.confirmedAt);
  observe('SessionEnd', 'turn-2');
  assert.equal(s.sessions()[0].confirmedAt, confirmed.confirmedAt);
  const thread = { id, title: '会话', cwd: '/tmp/project', updatedAt: s.at(), state: 'unknown' };
  s.syncCodexThreads([thread]); s.syncCodexThreads([thread]);
  assert.equal(s.sessions()[0].confirmedAt, confirmed.confirmedAt);
  assert.equal(s.sessions()[0].state, 'completed');
  now++; s.syncCodexThreads([{ ...thread, updatedAt: s.at() }]);
  assert.equal(s.sessions()[0].confirmedAt, undefined);
  s.confirmSession(input()); observe('UserPromptSubmit', 'turn-3');
  assert.equal(s.sessions()[0].confirmedAt, undefined);
  now++; s.syncCodexThreads([{ ...thread, updatedAt: s.at(), state: 'idle' }]);
  const catalogConfirmed = s.confirmSession(input());
  now++; s.syncCodexThreads([{ ...thread, updatedAt: s.sessions()[0].catalogUpdatedAt, state: 'idle' }]);
  assert.equal(s.sessions()[0].confirmedAt, catalogConfirmed.confirmedAt);
  s.syncCodexThreads([{ ...thread, updatedAt: s.at(), state: 'running' }]);
  assert.equal(s.sessions()[0].confirmedAt, undefined);
  observe('PermissionRequest'); assert.throws(() => s.confirmSession(input()), /只有/);
  observe('Interrupt'); assert.throws(() => s.confirmSession(input()), /只有/);
  observe('Stop');
  const task = s.command({ action: 'create', kind: 'task', requestId: randomUUID(), data: { title: '关联任务' } });
  s.command({ action: 'bind', id: task.id, revision: task.revision, sessionId: id });
  assert.throws(() => s.confirmSession(input()), /任务验收/);
  assert.equal(commandSchema.safeParse({ action: 'confirm_session', ...input() }).success, false);
  for (const state of ['waiting', 'waiting_input', 'queued']) {
    const oldId = randomUUID();
    s.db.prepare('INSERT INTO sessions VALUES (?,?)').run(oldId, JSON.stringify({ id: oldId, observedState: state, observedAt: s.at() }));
  }
  now += 300001;
  assert.ok(s.sessions().filter(session => session.id !== id).every(session => session.state === 'unknown'));
});
