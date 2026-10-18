const DAY_MS = 24 * 60 * 60 * 1000;
const minimumDaysByZoom = { day: 14, week: 56, month: 180 } as const;
const maximumDaysByZoom = { day: 90, week: 365, month: 720 } as const;

function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function shiftLocalDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function localDayIndex(timestamp: number) {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

export function timelineWindowForTasks(
  tasks: Array<{ plannedStart?: string | null; plannedEnd?: string | null; state?: string }>,
  zoom: keyof typeof minimumDaysByZoom,
  now = Date.now(),
) {
  const ranges = tasks.flatMap(task => {
    if (!task.plannedStart || !task.plannedEnd || task.state === 'cancelled') return [];
    const start = Date.parse(task.plannedStart), end = Date.parse(task.plannedEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
    return [{ start: startOfLocalDay(start), end: startOfLocalDay(end) }];
  });

  const earliest = ranges.length ? Math.min(...ranges.map(range => range.start)) : startOfLocalDay(now);
  const latest = ranges.length ? Math.max(...ranges.map(range => range.end)) : null;
  const anchor = shiftLocalDays(earliest, -3);
  const taskEnd = latest === null ? shiftLocalDays(anchor, minimumDaysByZoom[zoom]) : shiftLocalDays(latest, 4);
  const taskSpan = localDayIndex(taskEnd) - localDayIndex(anchor);

  return {
    anchor,
    days: Math.min(maximumDaysByZoom[zoom], Math.max(minimumDaysByZoom[zoom], taskSpan)),
  };
}

export function timelineAxisColumnWidths(days: number, step: number, dayWidth: number) {
  return Array.from({ length: Math.ceil(days / step) }, (_, index) =>
    Math.min(step, days - index * step) * dayWidth,
  );
}

export function tasksOutsideTimelineWindow<T extends { plannedStart?: string | null; plannedEnd?: string | null }>(
  tasks: T[],
  anchor: number,
  days: number,
) {
  const endDate = new Date(anchor);
  endDate.setDate(endDate.getDate() + days);
  const end = endDate.getTime();
  return {
    earlier: tasks.filter(task => task.plannedEnd && Date.parse(task.plannedEnd) <= anchor),
    later: tasks.filter(task => task.plannedStart && Date.parse(task.plannedStart) >= end),
  };
}

export function tasksInTimelineWindow<T extends { plannedStart?: string | null; plannedEnd?: string | null }>(
  tasks: T[],
  anchor: number,
  days: number,
) {
  const endDate = new Date(anchor);
  endDate.setDate(endDate.getDate() + days);
  const end = endDate.getTime();
  return tasks.filter(task => {
    if (!task.plannedStart || !task.plannedEnd) return false;
    const start = Date.parse(task.plannedStart), taskEnd = Date.parse(task.plannedEnd);
    return Number.isFinite(start) && Number.isFinite(taskEnd) && taskEnd > anchor && start < end;
  });
}
