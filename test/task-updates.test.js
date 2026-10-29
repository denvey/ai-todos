import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeTaskUpdates } from '../ui/task-updates.ts';

test('a schedule save updates only its task and preserves live AI observations', () => {
  const ai = { state: 'running', observedAt: '2026-10-29T10:00:00Z' };
  const original = { id: 'one', revision: 2, plannedStart: null, plannedEnd: null, ai };
  const other = { id: 'two', revision: 1 };
  const updated = { id: 'one', revision: 3, plannedStart: '2026-10-30T00:00:00Z', plannedEnd: '2026-10-31T00:00:00Z' };
  const result = mergeTaskUpdates([original, other], [updated]);
  assert.deepEqual(result[0], { ...updated, ai });
  assert.equal(result[1], other);
  assert.equal(original.plannedStart, null);
});

test('an older background snapshot cannot undo a saved schedule or restore a deleted task', () => {
  const ai = { state: 'idle', observedAt: '2026-10-29T10:01:00Z' };
  const staleSnapshot = [{ id: 'one', revision: 2, plannedStart: null, ai }, { id: 'two', revision: 5 }];
  const local = [{ id: 'one', revision: 3, plannedStart: '2026-10-30T00:00:00Z', ai: { state: 'running' } }, { id: 'two', revision: 4 }, { id: 'deleted', revision: 1 }];
  const result = mergeTaskUpdates(staleSnapshot, local);
  assert.equal(result[0].revision, 3);
  assert.equal(result[0].plannedStart, local[0].plannedStart);
  assert.equal(result[0].ai, ai);
  assert.equal(result[1], staleSnapshot[1]);
  assert.equal(result.length, 2);
  assert.equal(mergeTaskUpdates(result, local)[0], result[0]);
});
