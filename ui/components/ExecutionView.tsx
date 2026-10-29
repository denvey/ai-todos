import { useTranslation } from 'react-i18next';
import { getLocale } from '../i18n.ts';
// Adapted from Xinmo Desktop ExecutionView.tsx: callbacks replace desktop backend calls.
import type { CSSProperties, DragEvent, PointerEvent } from 'react';
import type { Task, Project, LiveSession } from '../../src/types.ts';
import type { TaskCallbacks, RescheduleEdge } from '../types.ts';
import { useEffect, useRef, useState } from 'react';
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, ListTodo, ExternalLink, Check, CheckCheck, LoaderCircle, Code2, Play } from 'lucide-react';
import { fmt, labels, priorityLabels, runtimeLabel } from '../format.ts';
import { runtimeState } from '../../src/runtime.ts';
import { boardColumns, executionColumnForTask, executionColumnForSession as sessionColumn, taskStatus, taskNextStep, canConfirmAiSession, boardDropDecision } from '../execution-board.ts';
import { tasksInTimelineWindow, tasksOutsideTimelineWindow, timelineAxisColumnWidths, timelineWindowForTasks } from '../timeline-window.ts';
export { boardColumns, sessionColumn };

export function AiBadge({ task }: { task: Pick<Task, 'ai' | 'sessionId'> }) {
  const { t } = useTranslation();
  return <span className={`execution-status status-${runtimeState(task.ai?.state)}`} title={task.ai ? t("session.source", { value: task.ai.source === 'codex-hook' ? 'Codex hook' : t("session.api"), value2: fmt(task.ai.observedAt), event: task.ai.event }) : t("session.observeHint")}>
    {task.sessionId ? ['idle', 'completed'].includes(runtimeState(task.ai?.state)) ? t('runtime.turnEnded') : runtimeLabel(task.ai || { state: 'unknown' }) : t("session.unlinked")}
  </span>;
}

interface ExecutionCardProps extends Pick<TaskCallbacks, 'onOpenTask'>, Partial<Pick<TaskCallbacks, 'onOpenSession' | 'onReviewTask' | 'onOpenCodex' | 'onCompleteTask'>> { task: Task; projects: Project[]; busy: boolean; onDragStart?: (event: DragEvent, task: Task) => void; onDragEnd?: () => void }

export function ExecutionCard({ task, projects, busy, onOpenTask, onOpenSession, onReviewTask, onOpenCodex, onCompleteTask, onDragStart, onDragEnd }: ExecutionCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const dragged = useRef(false);
  const column = executionColumnForTask(task), status = taskStatus(task), next = taskNextStep(task);
  return <article className="execution-card execution-task-card" draggable={!!onDragStart && !busy && !['accepted', 'cancelled'].includes(task.state) && boardColumns.some(target => boardDropDecision(task, target.dropTarget).action)}
    onDragStart={event => { dragged.current = true; onDragStart?.(event, task); }}
    onDragEnd={() => { onDragEnd?.(); setTimeout(() => { dragged.current = false; }, 0); }}>
    <div className="execution-card__summary">
      <button type="button" className="execution-card__title" disabled={busy} aria-label={t("task.openDetails", { title: task.title })} onClick={() => { if (!dragged.current) onOpenTask(task.id); }}><strong title={task.title}>{task.title}</strong></button>
      <button type="button" className="execution-card__expand" disabled={busy} aria-label={t("task.expand", { title: task.title })} aria-expanded={expanded} aria-controls={`execution-task-${task.id}`} onClick={() => { if (!dragged.current) setExpanded(value => !value); }}><ChevronDown size={14} aria-hidden="true" /></button>
    </div>
    <div className="execution-card__primary execution-card__actions">
      <span className={`execution-status status-${column === 'completed' ? 'accepted' : task.state === 'awaiting_acceptance' ? task.state : task.ai ? runtimeState(task.ai.state) : task.state}`}>{status}</span>
      <div className="execution-card__buttons">
        {next?.action === 'complete' && task.sessionId && onOpenCodex && <button type="button" disabled={busy} onClick={() => onOpenCodex(task)}><ExternalLink size={12} />{t("session.open")}</button>}
        {next && <button type="button" className={next.action === 'complete' ? undefined : 'is-next-action'} disabled={busy} onClick={() => next.action === 'start' && onOpenCodex ? onOpenCodex(task) : next.action === 'complete' && onCompleteTask ? onCompleteTask(task) : next.action === 'review' && onReviewTask ? onReviewTask(task) : next.action === 'session' && onOpenSession ? onOpenSession(task.sessionId!) : onOpenTask(task.id)}>{next.action === 'start' ? <Play size={12} /> : next.action === 'review' ? <ListTodo size={12} /> : next.action === 'session' ? <ExternalLink size={12} /> : <Check size={12} />}{t(next.label)}</button>}
      </div>
    </div>
    {(!task.sessionId || (task.ai && status !== runtimeLabel(task.ai))) && <div className="execution-card__badges"><AiBadge task={task} /></div>}
    {next && <small className="execution-card__next-hint">{t(next.hint)}</small>}
    <div id={`execution-task-${task.id}`} className="execution-card__content" hidden={!expanded}>
      <div className="execution-card__body">
        <span className="execution-card__topline"><span>{t("task.priorityLabel", { priority: t(priorityLabels[task.priority]) })}</span><span>r{task.revision}</span></span>
        <small>{projects.find(project => project.id === task.projectId)?.title || t("project.none")} · {task.plannedStart ? `${fmt(task.plannedStart)} → ${fmt(task.plannedEnd)}` : t("schedule.unscheduled")}</small>
        {status !== t(labels[task.state]) && <small>{t("task.deliveryState", { state: t(labels[task.state]) })}</small>}
        {task.description && <small>{task.description}</small>}
      </div>
      <div className="execution-card__actions">{task.state === 'awaiting_acceptance' && onReviewTask && <button type="button" disabled={busy} onClick={() => onReviewTask!(task, 'reject')}>{t("review.reject")}</button>}</div>
    </div>
  </article>;
}

interface SessionCardProps extends Pick<TaskCallbacks, 'onOpenSession' | 'onConfirmSession'> { session: LiveSession; tasks: Task[]; projects: Project[]; busy: boolean; onDragStart?: (event: DragEvent, session: LiveSession) => void; onDragEnd?: () => void }
function SessionCard({ session, tasks, projects, busy, onOpenSession, onConfirmSession, onDragStart, onDragEnd }: SessionCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const workspace = projects.find(project => project.codex?.workspacePath === session.cwd)?.title || session.cwd?.split(/[\\/]/).pop();
  const title = session.title || `Codex · ${workspace || session.id.slice(-8)}`;
  const canConfirm = canConfirmAiSession(session, tasks);
  const completed = sessionColumn(session) === 'completed';
  return <article className="execution-card execution-session-card" draggable={!busy && canConfirm && !!onDragStart} title={canConfirm ? t("session.dragConfirm") : undefined} onDragStart={event => onDragStart?.(event, session)} onDragEnd={onDragEnd}>
    <button type="button" className="execution-card__summary" aria-expanded={expanded} aria-controls={`execution-session-${session.id}`} onClick={() => setExpanded(value => !value)}><strong title={title}>{title}</strong><ChevronDown size={14} /></button>
    <div className="execution-card__primary execution-card__actions"><span className={`execution-status status-${completed ? 'accepted' : runtimeState(session.state)}`}>{completed ? t("board.completed") : runtimeLabel(session)}</span><div className="execution-card__buttons"><button type="button" disabled={busy} onClick={() => onOpenSession(session.id)}><ExternalLink size={12} />{t("session.open")}</button>{canConfirm && onConfirmSession && <button type="button" disabled={busy} onClick={() => onConfirmSession(session)}><Check size={12} />{t("session.confirm")}</button>}</div></div>
    <div id={`execution-session-${session.id}`} className="execution-card__content" hidden={!expanded}><div className="execution-card__body">
      <div className="execution-card__topline"><span className="execution-session-card__source" title={session.cwd}><Code2 size={11} aria-hidden="true" /><span>Codex{workspace ? ` · ${workspace}` : ''}</span></span><span>{fmt(session.catalogUpdatedAt || session.observedAt)}</span></div>
      {session.confirmedAt && <small>{t("session.confirmedAt", { at: fmt(session.confirmedAt) })}</small>}
    </div></div>
  </article>;
}

export function BoardView({ tasks, allTasks = tasks, sessions = [], projects, busy, onOpenTask, onOpenSession, onConfirmSession, onReviewTask, onOpenCodex, onCompleteTask, onTransition, onError }: Omit<TaskCallbacks, 'onReschedule'> & { tasks: Task[]; allTasks?: Task[]; sessions?: LiveSession[]; projects: Project[]; busy: boolean; onError: (message: string) => void }) {
  const { t } = useTranslation();
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [showCompletedHistory, setShowCompletedHistory] = useState(false);
  const [sessionLimits, setSessionLimits] = useState<Record<string, number>>({});
  const batchRunning = useRef(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const confirming = useRef(new Set<string>());
  const [confirmingSessions, setConfirmingSessions] = useState<string[]>([]);
  const confirmSession: TaskCallbacks['onConfirmSession'] = async session => {
    if (busy || batchRunning.current || confirming.current.has(session.id)) return false;
    confirming.current.add(session.id); setConfirmingSessions([...confirming.current]);
    try { return await onConfirmSession(session); }
    finally { confirming.current.delete(session.id); setConfirmingSessions([...confirming.current]); }
  };
  const confirmableSessions = sessions.filter(session => canConfirmAiSession(session, allTasks));
  const confirmAllSessions = async () => {
    if (busy || batchRunning.current || confirming.current.size || !confirmableSessions.length) return;
    batchRunning.current = true;
    const pending = [...confirmableSessions];
    let succeeded = 0;
    setBatchProgress({ done: 0, total: pending.length });
    try {
      for (const [index, session] of pending.entries()) {
        try { if (await onConfirmSession(session, true)) succeeded++; }
        catch { /* Keep processing the remaining sessions after an individual failure. */ }
        setBatchProgress({ done: index + 1, total: pending.length });
      }
      onError(t("session.confirmAllResult", { succeeded, failed: pending.length - succeeded }));
    } finally {
      batchRunning.current = false;
      setBatchProgress(null);
    }
  };
  const endDrag = () => setDropTarget(null);
  const renderTask = (task: Task) => <ExecutionCard key={task.id} task={task} projects={projects} busy={busy} onOpenTask={onOpenTask} onOpenSession={onOpenSession} onReviewTask={onReviewTask} onOpenCodex={onOpenCodex} onCompleteTask={onCompleteTask}
    onDragStart={(event, value) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/ai-todos', JSON.stringify({ id: value.id, revision: value.revision })); }} onDragEnd={endDrag} />;
  const renderSession = (session: LiveSession) => <SessionCard key={session.id} session={session} tasks={allTasks} projects={projects} busy={busy || !!batchProgress || confirmingSessions.includes(session.id)} onOpenSession={onOpenSession} onConfirmSession={confirmSession}
    onDragStart={(event, value) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/ai-todos-session', JSON.stringify({ id: value.id, observedAt: value.observedAt, event: value.event, turnId: value.turnId, catalogUpdatedAt: value.catalogUpdatedAt })); }} onDragEnd={endDrag} />;
  const completedItems = [
    ...tasks.filter(task => executionColumnForTask(task) === 'completed').map(task => ({ kind: 'task' as const, value: task, at: task.review?.at || task.updatedAt })),
    ...sessions.filter(session => sessionColumn(session) === 'completed').map(session => ({ kind: 'session' as const, value: session, at: session.confirmedAt })),
  ].sort((left, right) => (Date.parse(right.at ?? '') || 0) - (Date.parse(left.at ?? '') || 0));
  return <><div className="execution-board" aria-label={t("board.label")} tabIndex={0}>
    {boardColumns.map(column => {
      const items = tasks.filter(task => column.stages.includes(executionColumnForTask(task)));
      const sessionItems = sessions.filter(session => sessionColumn(session) === column.id);
      const completed = column.id === 'completed';
      if (completed) items.sort((left, right) => (Date.parse(right.updatedAt) || 0) - (Date.parse(left.updatedAt) || 0));
      return <section className={`execution-column column-${column.id} ${dropTarget === column.id ? 'is-drop-target' : ''}`} key={column.id} aria-labelledby={`execution-column-${column.id}`}
        onDragOver={event => { if (!busy && (event.dataTransfer.types.includes('application/ai-todos') || (column.id === 'completed' && event.dataTransfer.types.includes('application/ai-todos-session')))) { event.preventDefault(); setDropTarget(column.id); } }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) endDrag(); }}
        onDrop={event => {
          event.preventDefault(); endDrag();
          if (busy) return;
          try {
            if (event.dataTransfer.types.includes('application/ai-todos-session')) {
              const value = JSON.parse(event.dataTransfer.getData('application/ai-todos-session'));
              const session = sessions.find(item => item.id === value.id);
              if (column.id !== 'completed' || !session || !canConfirmAiSession(session, allTasks)) throw new Error(t("session.invalidConfirmation"));
              confirmSession(value); return;
            }
            if (!event.dataTransfer.types.includes('application/ai-todos')) return;
            const value = JSON.parse(event.dataTransfer.getData('application/ai-todos'));
            const task = tasks.find(item => item.id === value.id);
            if (!task) return;
            const decision = boardDropDecision(task, column.dropTarget);
            if (decision.reason) throw new Error(decision.reason);
            if (decision.action === 'request_changes') {
              if (task.revision !== value.revision) throw new Error(t("board.taskChanged"));
              onReviewTask!(task, 'reject');
            } else onTransition(task.id, value.revision, 'executing');
          } catch (error) { onError(error instanceof Error ? error.message : String(error)); }
        }}>
        <header><span><i aria-hidden="true" /><strong id={`execution-column-${column.id}`}>{t(column.label)}</strong></span><em>{t("board.taskCount", { count: items.length })}{sessionItems.length > 0 && <> · {t("board.sessionCount", { count: sessionItems.length })}</>}</em>
        {column.id === 'waiting_user' && (confirmableSessions.length > 0 || batchProgress) && <button type="button" className="execution-column__bulk" disabled={busy || !!batchProgress || confirmingSessions.length > 0} title={batchProgress ? t("session.confirmAllProgress", batchProgress) : `${t("session.confirmAll")}：${t("session.confirmAllHint")}`} aria-label={batchProgress ? t("session.confirmAllProgress", batchProgress) : t("session.confirmAll")} aria-live="polite" onClick={confirmAllSessions}>{batchProgress ? <LoaderCircle size={14} aria-hidden="true" /> : <CheckCheck size={14} aria-hidden="true" />}</button>}</header>
        <div className="execution-column__tasks" tabIndex={0} aria-label={t("board.cards", { label: t(column.label) })}>
          {completed ? completedItems.slice(0, showCompletedHistory ? undefined : 5).map(item => item.kind === 'task' ? renderTask(item.value) : renderSession(item.value)) : <>{items.map(renderTask)}{sessionItems.slice(0, sessionLimits[column.id] || 50).map(renderSession)}</>}
          {!completed && sessionItems.length > (sessionLimits[column.id] || 50) && <button type="button" className="execution-column__history" onClick={() => setSessionLimits(current => ({ ...current, [column.id]: (current[column.id] || 50) + 50 }))}>{t("board.moreSessions", { count: sessionItems.length - (sessionLimits[column.id] || 50) })}</button>}
          {!items.length && !sessionItems.length && <div className="execution-column__empty">{t("board.empty")}</div>}
        </div>
        {completed && completedItems.length > 5 && <button type="button" className="execution-column__history" aria-expanded={showCompletedHistory} onClick={() => setShowCompletedHistory(value => !value)}>{showCompletedHistory ? t("board.collapseHistory") : t("board.historyCount", { count: completedItems.length })}</button>}
      </section>;
    })}
  </div>
  </>;
}

function TimelineBar({ task, anchor, dayWidth, width, busy, onOpenTask, onReschedule }: Pick<TaskCallbacks, 'onOpenTask' | 'onReschedule'> & { task: Task; anchor: number; dayWidth: number; width: number; busy: boolean }) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<{ left: number; width: number } | null>(null);
  const pointer = useRef<{ id: number; x: number; edge?: RescheduleEdge } | null>(null);
  const suppressClick = useRef(false);
  const start = (Date.parse(task.plannedStart!) - anchor) / 86400000 * dayWidth;
  const end = (Date.parse(task.plannedEnd!) - anchor) / 86400000 * dayWidth;
  const left = Math.max(0, start), originalWidth = Math.max(8, Math.min(width, end) - left);
  if (end <= 0 || start >= width) return null;
  const locked = ['accepted', 'awaiting_acceptance'].includes(task.state);
  const finishPointer = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const active = pointer.current;
    if (!active || active.id !== event.pointerId) return;
    const distance = event.clientX - active.x;
    const days = Math.round(distance / dayWidth);
    pointer.current = null; setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled && Math.abs(distance) >= 4) {
      suppressClick.current = true;
      if (days) onReschedule(task, days, active.edge);
      setTimeout(() => { suppressClick.current = false; }, 0);
    }
  };
  return <button type="button" className={`timeline-bar ${preview ? 'is-dragging' : ''}`} disabled={busy}
    style={{ left: preview?.left ?? left, width: preview?.width ?? originalWidth }}
    onPointerDown={event => { if (event.button !== 0 || locked) return; pointer.current = { id: event.pointerId, x: event.clientX, edge: (event.target as HTMLElement).dataset.edge as RescheduleEdge | undefined }; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={event => {
      const active = pointer.current;
      if (!active || active.id !== event.pointerId) return;
      const delta = event.clientX - active.x;
      if (Math.abs(delta) >= 4) setPreview({ left: left + (active.edge === 'end' ? 0 : delta), width: Math.max(8, originalWidth + (active.edge === 'end' ? delta : active.edge === 'start' ? -delta : 0)) });
    }}
    onPointerUp={event => finishPointer(event)} onPointerCancel={event => finishPointer(event, true)}
    onClick={() => { if (!suppressClick.current) onOpenTask(task.id); }}
    onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); onReschedule(task, event.key === 'ArrowLeft' ? -1 : 1, event.shiftKey ? 'end' : undefined); } }}
    aria-label={t("timeline.range", { title: task.title, value: fmt(task.plannedStart), value2: fmt(task.plannedEnd) })} title={`${fmt(task.plannedStart)} → ${fmt(task.plannedEnd)}`}>
    {!locked && <span className="resize-handle start" data-edge="start" />}{task.title}{!locked && <span className="resize-handle end" data-edge="end" />}
  </button>;
}

export function TimelineView({ tasks, projects, busy, onOpenTask, onOpenSession, onReviewTask, onOpenCodex, onCompleteTask, onReschedule }: Omit<TaskCallbacks, 'onTransition' | 'onConfirmSession'> & { tasks: Task[]; projects: Project[]; busy: boolean }) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('day');
  const todayAnchor = () => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - 3); return date.getTime(); };
  const scheduled = tasks.filter(task => task.plannedStart && task.state !== 'cancelled');
  const unscheduled = tasks.filter(task => !task.plannedStart && !['cancelled', 'accepted'].includes(task.state));
  const scheduleKey = scheduled.map(task => `${task.id}:${task.plannedStart}:${task.plannedEnd}`).join('|');
  const [anchor, setAnchor] = useState(() => timelineWindowForTasks(scheduled, 'day').anchor);
  useEffect(() => { setAnchor(timelineWindowForTasks(scheduled, zoom).anchor); }, [scheduleKey]);
  const days = timelineWindowForTasks(scheduled, zoom).days;
  const dayWidth = { day: 60, week: 26, month: 10 }[zoom], step = { day: 1, week: 7, month: 30 }[zoom], width = dayWidth * days;
  const axisColumns = timelineAxisColumnWidths(days, step, dayWidth);
  const panDays = { day: 14, week: 56, month: 180 }[zoom];
  const outside = tasksOutsideTimelineWindow(scheduled, anchor, days);
  const visibleScheduled = tasksInTimelineWindow(scheduled, anchor, days);
  const earlierTask = outside.earlier.sort((left, right) => Date.parse(right.plannedStart!) - Date.parse(left.plannedStart!))[0];
  const laterTask = outside.later.sort((left, right) => Date.parse(left.plannedStart!) - Date.parse(right.plannedStart!))[0];
  const moveAnchor = (offset: number) => setAnchor(current => {
    const date = new Date(current);
    date.setDate(date.getDate() + offset);
    return date.getTime();
  });
  return <div className="execution-timeline">
    <div className="timeline-toolbar"><span><CalendarRange size={15} />{t("timeline.window", { count: scheduled.length })}</span>
      {(outside.earlier.length > 0 || outside.later.length > 0) && <div className="timeline-window-actions" role="status">
        <small>{t("timeline.outsideWindow", { before: outside.earlier.length, after: outside.later.length })}</small>
        {earlierTask && <button type="button" onClick={() => setAnchor(timelineWindowForTasks([earlierTask], zoom).anchor)}>{t("timeline.earlierTasks", { count: outside.earlier.length })}<ChevronLeft size={13} /></button>}
        {laterTask && <button type="button" onClick={() => setAnchor(timelineWindowForTasks([laterTask], zoom).anchor)}>{t("timeline.laterTasks", { count: outside.later.length })}<ChevronRight size={13} /></button>}
      </div>}
      <div className="row"><button aria-label={t("timeline.backward")} onClick={() => moveAnchor(-panDays)}>←</button><button onClick={() => setAnchor(todayAnchor())}>{t("time.today")}</button><button aria-label={t("timeline.forward")} onClick={() => moveAnchor(panDays)}>→</button>
        <div className="segmented-control timeline-zoom" aria-label={t("timeline.granularity")}>{([['day', t("timeline.day")], ['week', t("timeline.week")], ['month', t("timeline.month")]] as const).map(([value, label]) => <button key={value} className={zoom === value ? 'is-active' : ''} aria-pressed={zoom === value} onClick={() => setZoom(value)}>{label}</button>)}</div>
      </div>
    </div>
    <div className="timeline-table"><div className="timeline-label-column"><div className="timeline-label-heading">{t("timeline.taskProject")}</div>{visibleScheduled.map(task => <div className="timeline-task-label" key={task.id}><button className="quiet" onClick={() => onOpenTask(task.id)} title={task.title}>{task.title}</button><small>{projects.find(project => project.id === task.projectId)?.title || t("project.none")} · {t(labels[task.state])}</small></div>)}</div>
      <div className="timeline-scroll" tabIndex={0} aria-label={t("timeline.axis")}><div className="timeline-canvas" style={{ width }}>
        <div className="timeline-axis" style={{ gridTemplateColumns: axisColumns.map(columnWidth => `${columnWidth}px`).join(' ') }}>{axisColumns.map((_, index) => <span key={index}><strong>{new Date(anchor + index * step * 86400000).toLocaleDateString(getLocale(), { month: 'short', day: 'numeric' })}</strong></span>)}</div>
        {visibleScheduled.map(task => <div className="timeline-row" key={task.id} style={{ '--timeline-cell': `${dayWidth}px` } as CSSProperties}><TimelineBar task={task} anchor={anchor} dayWidth={dayWidth} width={width} busy={busy} onOpenTask={onOpenTask} onReschedule={onReschedule} /></div>)}
        {!visibleScheduled.length && <p className="empty-state">{t("timeline.empty")}</p>}
      </div></div>
    </div>
    <section className="execution-unscheduled"><header><span><ListTodo size={15} /><strong>{t("schedule.unscheduled")}</strong></span><em>{unscheduled.length}</em></header><div>{unscheduled.map(task => <ExecutionCard key={task.id} task={task} projects={projects} busy={busy} onOpenTask={onOpenTask} onOpenSession={onOpenSession} onReviewTask={onReviewTask} onOpenCodex={onOpenCodex} onCompleteTask={onCompleteTask} />)}</div>{!unscheduled.length && <p>{t("timeline.allScheduled")}</p>}</section>
    <p className="muted">{t("timeline.controls")}</p>
  </div>;
}
