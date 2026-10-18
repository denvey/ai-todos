import test from 'node:test';
import assert from 'node:assert/strict';
import { timelineAxisColumnWidths, timelineWindowForTasks, tasksInTimelineWindow, tasksOutsideTimelineWindow } from '../ui/timeline-window.ts';

const DAY = 24 * 60 * 60 * 1000;
const dateAt = (year, month, day, hour = 12) => new Date(year, month - 1, day, hour).getTime();
const task = (plannedStart, plannedEnd, state = 'ready') => ({
  plannedStart: new Date(plannedStart).toISOString(),
  plannedEnd: new Date(plannedEnd).toISOString(),
  state,
});

test('empty timeline opens on a two-week window around today', () => {
  const now = dateAt(2026, 10, 18);
  const expectedAnchor = new Date(2026, 9, 15).getTime();

  assert.deepEqual(timelineWindowForTasks([], 'day', now), { anchor: expectedAnchor, days: 14 });
});

test('scheduled work opens with padding around the earliest start and latest end', () => {
  const now = dateAt(2026, 10, 18);
  const tasks = [
    task(dateAt(2026, 10, 28, 9), dateAt(2026, 10, 29, 17)),
    task(dateAt(2026, 11, 2, 10), dateAt(2026, 11, 4, 16)),
  ];
  const window = timelineWindowForTasks(tasks, 'day', now);

  assert.equal(window.anchor, new Date(2026, 9, 25).getTime());
  assert.equal(window.days, 14);
  assert.ok(window.anchor + window.days * DAY > dateAt(2026, 11, 4));
});

test('zoom level sets a readable minimum range while distant tasks expand the window', () => {
  const now = dateAt(2026, 10, 18);
  const quarterSpan = [task(dateAt(2026, 10, 28), dateAt(2026, 12, 20))];

  assert.equal(timelineWindowForTasks([], 'week', now).days, 56);
  assert.equal(timelineWindowForTasks([], 'month', now).days, 180);
  assert.ok(timelineWindowForTasks(quarterSpan, 'day', now).days > 14);
});

test('extreme task spans stay within a bounded canvas at every zoom level', () => {
  const now = dateAt(2026, 10, 18);
  const distantTasks = [
    task(dateAt(2026, 10, 28), dateAt(2026, 10, 30)),
    task(dateAt(2036, 10, 28), dateAt(2036, 10, 30)),
  ];

  assert.equal(timelineWindowForTasks(distantTasks, 'day', now).days, 90);
  assert.equal(timelineWindowForTasks(distantTasks, 'week', now).days, 365);
  assert.equal(timelineWindowForTasks(distantTasks, 'month', now).days, 720);
});

test('timeline axis columns end at the canvas width for partial week and month intervals', () => {
  for (const [days, step, dayWidth] of [[365, 7, 26], [181, 30, 10]]) {
    const columns = timelineAxisColumnWidths(days, step, dayWidth);

    assert.equal(columns.reduce((sum, width) => sum + width, 0), days * dayWidth);
    assert.ok(columns.at(-1) > 0);
    assert.ok(columns.at(-1) <= step * dayWidth);
  }
});

test('window navigation identifies scheduled tasks before and after the visible range', () => {
  const anchor = new Date(2026, 9, 15).getTime();
  const tasks = [
    task(dateAt(2026, 10, 1), dateAt(2026, 10, 2)),
    task(dateAt(2026, 10, 14), anchor),
    task(dateAt(2026, 10, 20), dateAt(2026, 10, 21)),
    task(dateAt(2026, 11, 2), dateAt(2026, 11, 3)),
  ];

  const outside = tasksOutsideTimelineWindow(tasks, anchor, 14);
  assert.deepEqual(outside.earlier, [tasks[0], tasks[1]]);
  assert.deepEqual(outside.later, [tasks[3]]);
  assert.deepEqual(tasksInTimelineWindow(tasks, anchor, 14), [tasks[2]]);
});

test('unscheduled, cancelled, and invalid ranges do not pull the timeline window outward', () => {
  const now = dateAt(2026, 10, 18);
  const tasks = [
    { state: 'ready' },
    task(dateAt(2027, 1, 1), dateAt(2027, 1, 3), 'cancelled'),
    { plannedStart: 'invalid', plannedEnd: 'invalid', state: 'ready' },
  ];

  assert.deepEqual(timelineWindowForTasks(tasks, 'day', now), {
    anchor: new Date(2026, 9, 15).getTime(),
    days: 14,
  });
});
