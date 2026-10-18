import { useTranslation } from 'react-i18next';
// Adapted from Xinmo TodayView, QuickCapture, TaskRow and DailyPlanEditor.
import type { Task, Plan, CaptureSuggestion, Snapshot } from '../../src/types.ts';
import type { CaptureCallbacks, TodayProps, DailyPlanDraft } from '../types.ts';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Check, ChevronRight, CornerDownLeft, Inbox, ListPlus, ListTodo, Pause, Play, Plus, Sparkles } from 'lucide-react';
import { FocusCard } from './FocusCard.tsx';
import { Field } from './TaskEditor.tsx';
import { labels, localDay, priorityLabels } from '../format.ts';
import { taskStatus } from '../execution-board.ts';

export function dayPlans(plans: Plan[], day: string) {
  return plans.filter(plan => plan.date === day).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
const ended = (task: Pick<Task, 'state'>) => ['accepted', 'cancelled'].includes(task.state);
const draftData = (title: string, improvement?: CaptureSuggestion | null) => ({ title: title.trim(), description: improvement?.description || '', criteria: improvement?.criteria || '' });

export const QuickCapture = forwardRef<{ focus: () => void }, CaptureCallbacks & { busy: boolean; visible?: boolean }>(function QuickCapture({ busy, onAdd, onCapture, onRefine, onCreateTask }, ref) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [improvement, setImprovement] = useState<CaptureSuggestion | null>(null);
  const [improving, setImproving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null), requests = useRef(new Map<string, string>());
  const focus = () => inputRef.current?.focus();
  const reset = () => { setTitle(''); setImprovement(null); requests.current.clear(); focus(); };
  useImperativeHandle(ref, () => ({ focus }));
  const requestId = (payload: unknown) => {
    const key = JSON.stringify(payload);
    if (!requests.current.has(key)) requests.current.set(key, crypto.randomUUID());
    return requests.current.get(key)!;
  };
  const addTask = async () => {
    if (busy || !title.trim()) return;
    const data = draftData(title, improvement);
    if (await onAdd([data], requestId({ action: 'today', data }))) reset();
  };
  const captureInbox = async () => {
    if (busy || !title.trim()) return;
    if (await onCapture(title.trim(), requestId({ action: 'inbox', title: title.trim() }))) reset();
  };
  const improve = async () => {
    if (busy || !title.trim()) return;
    setImproving(true);
    try {
      await onRefine({ title: title.trim() }, suggestion => { setTitle(suggestion.title); setImprovement(suggestion); });
    } finally { setImproving(false); focus(); }
  };
  const adoptBreakdown = async () => {
    const steps = improvement?.suggestedSteps || [];
    if (steps.length > 1 && await onAdd(steps, requestId({ action: 'split', steps }))) reset();
  };
  return <div className="quick-capture">
    <form className="quick-add quick-capture__form" onSubmit={event => { event.preventDefault(); addTask(); }}>
      <input ref={inputRef} value={title} disabled={busy} maxLength={300} onChange={event => { setTitle(event.target.value); setImprovement(null); requests.current.clear(); }}
        onKeyDown={event => { if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) return; event.preventDefault(); if (event.altKey) captureInbox(); else addTask(); }} placeholder={t("today.capturePlaceholder")} aria-label={t("task.title")} />
      {title.trim() && <button type="button" className={`quick-add-ai ${improving ? 'is-loading' : ''}`} onClick={improve} disabled={busy} aria-label={improving ? t("ai.improving") : t("ai.improve")} title={t("ai.improve")}><Sparkles size={14} aria-hidden="true" /></button>}
      <span className="quick-add__action-cluster"><span className="quick-add__hover-actions">
        <button type="button" className="quick-add-inbox" onClick={captureInbox} disabled={busy || !title.trim()} aria-label={t("inbox.capture")} title={t("inbox.captureShortcut")}><Inbox size={14} aria-hidden="true" /></button>
        <button type="button" className="quick-add-detail" onClick={() => onCreateTask(draftData(title, improvement), reset)} disabled={busy} aria-label={t("today.fullDefinition")} title={t("today.fullDefinition")}><ListPlus size={15} aria-hidden="true" /></button>
      </span><button className="quick-add-submit" type="submit" disabled={busy || !title.trim()} aria-label={t("today.addTask")} title={t("today.addTaskShortcut")}><CornerDownLeft size={15} aria-hidden="true" /></button></span>
    </form>
    {improvement && <div className="quick-add-assist" aria-live="polite"><div className="quick-add-assist__intro"><Sparkles size={14} aria-hidden="true" /><span><strong>{improvement.suggestedSteps.length > 1 ? t("today.suggestSplit") : t("today.draftImproved")}</strong><small>{improvement.reason || t("today.reviewDraft")}</small></span></div>
      <details><summary>{t("today.viewDefinition")}</summary><p>{improvement.description}</p><p>{improvement.criteria}</p></details>
      {improvement.suggestedSteps.length > 1 && <><ol>{improvement.suggestedSteps.map((step, index) => <li key={index}>{step.title}</li>)}</ol><div className="quick-add-assist__actions"><button type="button" onClick={() => setImprovement(current => ({ ...current!, suggestedSteps: [] }))} disabled={busy}>{t("today.keepSingle")}</button><button type="button" className="is-primary" onClick={adoptBreakdown} disabled={busy}>{t("today.splitCount", { count: improvement.suggestedSteps.length })}</button></div></>}
    </div>}
  </div>;
});

function TaskRow({ task, focus, busy, onOpenTask, onTaskAction, onFocusTask }: Pick<TodayProps, 'busy' | 'onOpenTask' | 'onTaskAction' | 'onFocusTask'> & { task: Task; focus: Snapshot['focus'] }) {
  const { t } = useTranslation();
  const active = focus.taskId === task.id && focus.status !== 'idle', paused = focus.status === 'paused', complete = ended(task);
  const action = complete ? t("task.reopen") : task.state === 'awaiting_acceptance' ? t("review.action") : t("task.openDelivery");
  return <div className={`task-row ${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}>
    <button className="task-check" onClick={() => onTaskAction(task)} disabled={busy} aria-label={`${action} ${task.title}`} title={action}>{complete && <Check size={14} />}</button>
    <button className="task-main" onClick={() => onOpenTask(task.id)} disabled={busy} aria-label={t("task.openNamed", { title: task.title })}><span className="task-title">{task.title}</span><span className="task-meta"><span className={`priority priority-${task.priority}`}>{t(priorityLabels[task.priority])}</span><span className="planned-label">{t("today.label")}</span><span className={`workflow-label ${task.state === 'awaiting_acceptance' ? 'awaiting' : task.state === 'changes_requested' ? 'changes' : ''}`}>{taskStatus(task)}</span>{active && <span className={`focus-state-label ${paused ? 'is-paused' : ''}`}>{paused ? t("focus.taskPaused") : t("focus.active")}</span>}</span></button>
    {!complete ? <button className={`task-focus ${active ? 'is-active' : ''}`} onClick={() => onFocusTask(task)} disabled={busy} aria-label={`${active ? paused ? t("focus.resume") : t("focus.pause") : t("focus.start")} ${task.title}`} title={active ? paused ? t("focus.resume") : t("focus.pause") : t("focus.start")}>{active && !paused ? <Pause size={16} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button> : <span className="task-focus-placeholder" aria-hidden="true" />}
  </div>;
}

export function TodayView({ snapshot, busy, visible, elapsedMs, onAdd, onCapture, onRefine, onCreateTask, onOpenTask, onTaskAction, onFocusTask, onFocusOp, onPlan, onInbox }: TodayProps) {
  const { t } = useTranslation();
  const quickRef = useRef<{ focus: () => void }>(null), previousCount = useRef(0);
  const [completedOpen, setCompletedOpen] = useState(false);
  const plans = dayPlans(snapshot.plans, localDay(new Date())), ids = [...new Set(plans.flatMap(plan => plan.taskIds))];
  const todayTasks = ids.map(id => snapshot.tasks.find(task => task.id === id)).filter((task): task is Task => !!task);
  const active = todayTasks.filter(task => !ended(task)).sort((a, b) => (({ awaiting_acceptance: 0, changes_requested: 1 } as Record<string, number>)[a.state] ?? 2) - (({ awaiting_acceptance: 0, changes_requested: 1 } as Record<string, number>)[b.state] ?? 2));
  const finished = todayTasks.filter(ended), accepted = finished.filter(task => task.state === 'accepted').length;
  const unplanned = snapshot.tasks.filter(task => !ended(task) && !ids.includes(task.id));
  const inboxCount = snapshot.inbox.filter(item => !item.archived).length;
  const fallback = snapshot.tasks.find(task => task.id === snapshot.focus.taskId) || active[0] || unplanned[0];
  useEffect(() => { if (accepted > previousCount.current) setCompletedOpen(true); previousCount.current = accepted; }, [accepted]);
  const progress = <div className="day-band"><div className="day-summary"><div className="day-summary__main"><strong>{t("today.progress")}</strong><span className="day-summary__meter"><i style={{ width: `${todayTasks.length ? accepted / todayTasks.length * 100 : 0}%` }} /></span><span className="day-summary__count">{accepted} / {todayTasks.length}</span></div>{plans[0]?.note && <p className="day-summary__message">{plans[0].note}</p>}</div></div>;
  const row = (task: Task) => <TaskRow key={task.id} task={task} focus={snapshot.focus} busy={busy} onOpenTask={onOpenTask} onTaskAction={onTaskAction} onFocusTask={onFocusTask} />;
  return <section className="today-view" hidden={!visible}>
    <section className="card task-section" aria-labelledby="tasks-heading"><div className="section-heading"><h2 id="tasks-heading">{t("today.tasks")}</h2><div className="section-heading__actions"><button className="text-button" disabled={busy} onClick={onInbox}><Inbox size={14} />{t("nav.inbox")}{inboxCount ? ` ${inboxCount}` : ''}</button><span className="count-label">{active.filter(task => task.state === 'awaiting_acceptance').length > 0 ? t("today.awaitingCount", { value: active.filter(task => task.state === 'awaiting_acceptance').length }) : ''}{t("today.incompleteCount", { count: active.length })}</span></div></div>
      <QuickCapture ref={quickRef} busy={busy} visible={visible} onAdd={onAdd} onCapture={onCapture} onRefine={onRefine} onCreateTask={onCreateTask} />
      {progress}
      <div className="task-list">{active.map(row)}{!active.length && <div className="empty-state"><strong>{unplanned.length ? t("today.notPlanned") : t("today.noTasks")}</strong><span>{unplanned.length ? t("today.poolHint", { count: unplanned.length }) : inboxCount ? t("today.inboxHint") : t("today.addHint")}</span></div>}</div>
      {!!finished.length && <details className="completed-group" open={completedOpen} onToggle={event => setCompletedOpen(event.currentTarget.open)}><summary>{t("today.acceptedCount", { count: accepted })}{finished.length > accepted ? t("today.cancelledCount", { value: finished.length - accepted }) : ''}</summary>{finished.map(row)}</details>}
      <button className="task-pool-entry" type="button" onClick={onPlan} disabled={busy} aria-label={unplanned.length ? t("today.chooseTasks") : t("today.arrange")}><ListTodo size={17} /><span><strong>{unplanned.length ? t("today.chooseTasks") : t("today.arrange")}</strong><small>{unplanned.length ? t("today.poolCount", { count: unplanned.length }) : t("today.adjust")}</small></span><span className="task-pool-entry__action">{t("today.arrangeAction")}<ChevronRight size={15} /></span></button>
    </section>
    <FocusCard focus={snapshot.focus} busy={busy} task={fallback} elapsedMs={elapsedMs} onStart={() => onFocusTask(fallback!)} onPause={() => onFocusOp('pause')} onResume={() => onFocusOp('resume')} onEnd={() => onFocusOp('finish')} onNeedTask={() => quickRef.current?.focus()} />
  </section>;
}

export function DailyPlanEditor({ snapshot, plans, initial, busy, onSave, onCreateTask, onInbox, onOpenTask }: { snapshot: Snapshot; plans: Plan[]; initial?: Partial<DailyPlanDraft>; busy: boolean; onSave: (data: DailyPlanDraft) => Promise<boolean>; onCreateTask: () => void; onInbox: () => void; onOpenTask: (id: string, draft: DailyPlanDraft) => Promise<boolean> }) {
  const { t } = useTranslation();
  const initialIds = [...new Set(plans.flatMap(plan => plan.taskIds))];
  const [selected, setSelected] = useState(() => new Set((initial?.taskIds || initialIds).filter(id => snapshot.tasks.some(task => task.id === id))));
  const [note, setNote] = useState(initial?.note ?? plans[0]?.note ?? '');
  const active = snapshot.tasks.filter(task => !ended(task)), finished = snapshot.tasks.filter(task => ended(task) && initialIds.includes(task.id)), history = snapshot.tasks.filter(task => task.state === 'accepted' && !initialIds.includes(task.id));
  const allSelected = !!active.length && active.every(task => selected.has(task.id));
  const toggleAll = () => setSelected(current => { const next = new Set(current); active.forEach(task => allSelected ? next.delete(task.id) : next.add(task.id)); return next; });
  const option = (task: Task, plannable = true) => <div key={task.id} className={`plan-task-option ${selected.has(task.id) ? 'is-selected' : ''} ${ended(task) ? 'is-completed' : ''}`}>
    <span className="plan-task-check-slot">{plannable ? <input id={`today-${task.id}`} type="checkbox" checked={selected.has(task.id)} disabled={busy} aria-label={`${selected.has(task.id) ? t("today.remove") : t("today.add")} ${task.title}`} onChange={event => setSelected(current => { const next = new Set(current); event.target.checked ? next.add(task.id) : next.delete(task.id); return next; })} /> : <Check size={15} />}</span>
    <div className="plan-task-option__main"><label className="plan-task-title" htmlFor={`today-${task.id}`} title={task.title}>{task.title}</label><small>{t(labels[task.state])} · {t(priorityLabels[task.priority])}{task.projectId ? ` · ${snapshot.projects.find(project => project.id === task.projectId)?.title || t("entity.project")}` : ''}</small></div>
    <div className="plan-task-option__actions"><span className={`plan-task-state ${selected.has(task.id) ? 'is-selected' : ''}`}>{selected.has(task.id) ? t("today.included") : task.state === 'accepted' ? t("today.accepted") : task.state === 'cancelled' ? t("state.cancelled") : t("today.notIncluded")}</span><button type="button" className="text-button" disabled={busy} onClick={() => onOpenTask(task.id, { taskIds: [...selected], note })} aria-label={t("task.editNamed", { title: task.title })}>{t("common.details")}<ChevronRight size={14} /></button></div>
  </div>;
  return <form onSubmit={event => { event.preventDefault(); onSave({ taskIds: [...selected], note }); }}><div className="task-editor__body">
    <p className="daily-plan-help"><ListTodo size={15} /><span><strong>{t("today.fromBacklog")}</strong><small>{t("today.selectionHint")}</small></span></p>
    <button type="button" className="plan-inbox-entry plan-create-task-entry" onClick={onCreateTask} disabled={busy}><Plus size={16} /><span><strong>{t("task.new")}</strong><small>{t("today.createHint")}</small></span><ChevronRight size={15} /></button>
    <button type="button" className="plan-inbox-entry" onClick={onInbox} disabled={busy}><Inbox size={16} /><span><strong>{t("today.inboxCount", { count: snapshot.inbox.filter(item => !item.archived).length })}</strong><small>{t("today.chooseIdeas")}</small></span><ChevronRight size={15} /></button>
    <section className="plan-task-panel"><header className="plan-task-panel__header"><span><strong>{t("today.backlog")}</strong><small>{t("today.selectedCount", { selected: active.filter(task => selected.has(task.id)).length, count: active.length })}</small></span><button type="button" className="plan-task-bulk" disabled={busy || !active.length} onClick={toggleAll}>{allSelected ? t("today.clearIncomplete") : t("today.selectAll")}</button></header><div className="plan-task-list">{active.map(task => option(task))}{!active.length && <p className="empty-state compact">{t("today.noIncomplete")}</p>}</div></section>
    {!!finished.length && <section className="plan-task-panel"><header className="plan-task-panel__header"><strong>{t("today.finishedCount", { count: finished.length })}</strong></header><div className="plan-task-list">{finished.map(task => option(task))}</div></section>}
    {!!history.length && <details className="plan-task-panel"><summary className="plan-task-panel__header">{t("today.historyCount", { count: history.length })}</summary><div className="plan-task-list">{history.map(task => option(task, false))}</div></details>}
    <Field label={t("today.note")} type="textarea" value={note} disabled={busy} onChange={setNote} />
  </div><footer className="task-editor__actions"><span className="selected-count">{t("today.totalCount", { count: selected.size })}</span><button className="primary" type="submit" disabled={busy}>{t("today.save")}</button></footer></form>;
}
