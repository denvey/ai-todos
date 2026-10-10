// Adapted from Xinmo TodayView, QuickCapture, TaskRow and DailyPlanEditor.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Check, ChevronRight, CornerDownLeft, Inbox, ListPlus, ListTodo, Pause, Play, Plus, Sparkles } from 'lucide-react';
import { FocusCard } from './FocusCard.jsx';
import { Field } from './TaskEditor.jsx';
import { labels, localDay, priorityLabels } from '../format.js';
import { taskStatus } from '../execution-board.js';

export function dayPlans(plans, day) {
  return plans.filter(plan => plan.date === day).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
const ended = task => ['accepted', 'cancelled'].includes(task.state);
const draftData = (title, improvement) => ({ title: title.trim(), description: improvement?.description || '', criteria: improvement?.criteria || '' });

export const QuickCapture = forwardRef(function QuickCapture({ busy, onAdd, onCapture, onRefine, onCreateTask }, ref) {
  const [title, setTitle] = useState('');
  const [improvement, setImprovement] = useState(null);
  const [improving, setImproving] = useState(false);
  const inputRef = useRef(null), requests = useRef(new Map());
  const focus = () => inputRef.current?.focus();
  const reset = () => { setTitle(''); setImprovement(null); requests.current.clear(); focus(); };
  useImperativeHandle(ref, () => ({ focus }));
  const requestId = payload => {
    const key = JSON.stringify(payload);
    if (!requests.current.has(key)) requests.current.set(key, crypto.randomUUID());
    return requests.current.get(key);
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
        onKeyDown={event => { if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) return; event.preventDefault(); if (event.altKey) captureInbox(); else addTask(); }} placeholder="输入任务，回车加入今天" aria-label="任务标题" />
      {title.trim() && <button type="button" className={`quick-add-ai ${improving ? 'is-loading' : ''}`} onClick={improve} disabled={busy} aria-label={improving ? 'AI 正在完善任务' : 'AI 完善任务'} title="AI 完善任务"><Sparkles size={14} aria-hidden="true" /></button>}
      <span className="quick-add__action-cluster"><span className="quick-add__hover-actions">
        <button type="button" className="quick-add-inbox" onClick={captureInbox} disabled={busy || !title.trim()} aria-label="存入收件箱" title="存入收件箱（⌥/Alt+↵）"><Inbox size={14} aria-hidden="true" /></button>
        <button type="button" className="quick-add-detail" onClick={() => onCreateTask(draftData(title, improvement), reset)} disabled={busy} aria-label="填写完整任务" title="填写完整任务"><ListPlus size={15} aria-hidden="true" /></button>
      </span><button className="quick-add-submit" type="submit" disabled={busy || !title.trim()} aria-label="添加今日任务" title="添加今日任务（↵）"><CornerDownLeft size={15} aria-hidden="true" /></button></span>
    </form>
    {improvement && <div className="quick-add-assist" aria-live="polite"><div className="quick-add-assist__intro"><Sparkles size={14} aria-hidden="true" /><span><strong>{improvement.suggestedSteps.length > 1 ? '这项任务值得拆开' : '任务草稿已由 AI 完善'}</strong><small>{improvement.reason || '可以查看说明与验收标准，再加入今天。'}</small></span></div>
      <details><summary>查看任务说明与验收标准</summary><p>{improvement.description}</p><p>{improvement.criteria}</p></details>
      {improvement.suggestedSteps.length > 1 && <><ol>{improvement.suggestedSteps.map((step, index) => <li key={index}>{step.title}</li>)}</ol><div className="quick-add-assist__actions"><button type="button" onClick={() => setImprovement(current => ({ ...current, suggestedSteps: [] }))} disabled={busy}>保留单项</button><button type="button" className="is-primary" onClick={adoptBreakdown} disabled={busy}>拆成 {improvement.suggestedSteps.length} 项</button></div></>}
    </div>}
  </div>;
});

function TaskRow({ task, focus, busy, onOpenTask, onTaskAction, onFocusTask }) {
  const active = focus.taskId === task.id && focus.status !== 'idle', paused = focus.status === 'paused', complete = ended(task);
  const action = complete ? '重开任务' : task.state === 'awaiting_acceptance' ? '审阅交付' : '打开任务处理交付';
  return <div className={`task-row ${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}>
    <button className="task-check" onClick={() => onTaskAction(task)} disabled={busy} aria-label={`${action} ${task.title}`} title={action}>{complete && <Check size={14} />}</button>
    <button className="task-main" onClick={() => onOpenTask(task.id)} disabled={busy} aria-label={`打开任务 ${task.title}`}><span className="task-title">{task.title}</span><span className="task-meta"><span className={`priority priority-${task.priority}`}>{priorityLabels[task.priority]}</span><span className="planned-label">今日</span><span className={`workflow-label ${task.state === 'awaiting_acceptance' ? 'awaiting' : task.state === 'changes_requested' ? 'changes' : ''}`}>{taskStatus(task)}</span>{active && <span className={`focus-state-label ${paused ? 'is-paused' : ''}`}>{paused ? '专注暂停中' : '当前专注'}</span>}</span></button>
    {!complete ? <button className={`task-focus ${active ? 'is-active' : ''}`} onClick={() => onFocusTask(task)} disabled={busy} aria-label={`${active ? paused ? '继续专注' : '暂停专注' : '开始专注'} ${task.title}`} title={active ? paused ? '继续专注' : '暂停专注' : '开始专注'}>{active && !paused ? <Pause size={16} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button> : <span className="task-focus-placeholder" aria-hidden="true" />}
  </div>;
}

export function TodayView({ snapshot, busy, visible, elapsedMs, onAdd, onCapture, onRefine, onCreateTask, onOpenTask, onTaskAction, onFocusTask, onFocusOp, onPlan, onInbox }) {
  const quickRef = useRef(null), previousCount = useRef(0);
  const [completedOpen, setCompletedOpen] = useState(false);
  const plans = dayPlans(snapshot.plans, localDay(new Date())), ids = [...new Set(plans.flatMap(plan => plan.taskIds))];
  const todayTasks = ids.map(id => snapshot.tasks.find(task => task.id === id)).filter(Boolean);
  const active = todayTasks.filter(task => !ended(task)).sort((a, b) => ({ awaiting_acceptance: 0, changes_requested: 1 }[a.state] ?? 2) - ({ awaiting_acceptance: 0, changes_requested: 1 }[b.state] ?? 2));
  const finished = todayTasks.filter(ended), accepted = finished.filter(task => task.state === 'accepted').length;
  const unplanned = snapshot.tasks.filter(task => !ended(task) && !ids.includes(task.id));
  const inboxCount = snapshot.inbox.filter(item => !item.archived).length;
  const fallback = snapshot.tasks.find(task => task.id === snapshot.focus.taskId) || active[0] || unplanned[0];
  useEffect(() => { if (accepted > previousCount.current) setCompletedOpen(true); previousCount.current = accepted; }, [accepted]);
  const progress = <div className="day-band"><div className="day-summary"><div className="day-summary__main"><strong>今日进度</strong><span className="day-summary__meter"><i style={{ width: `${todayTasks.length ? accepted / todayTasks.length * 100 : 0}%` }} /></span><span className="day-summary__count">{accepted} / {todayTasks.length}</span></div>{plans[0]?.note && <p className="day-summary__message">{plans[0].note}</p>}</div></div>;
  const row = task => <TaskRow key={task.id} task={task} focus={snapshot.focus} busy={busy} onOpenTask={onOpenTask} onTaskAction={onTaskAction} onFocusTask={onFocusTask} />;
  return <section className="today-view" hidden={!visible}>
    {snapshot.focus.status === 'idle' && progress}
    <FocusCard focus={snapshot.focus} busy={busy} task={fallback} elapsedMs={elapsedMs} onStart={() => onFocusTask(fallback)} onPause={() => onFocusOp('pause')} onResume={() => onFocusOp('resume')} onEnd={() => onFocusOp('finish')} onNeedTask={() => quickRef.current?.focus()} />
    {snapshot.focus.status !== 'idle' && progress}
    <section className="card task-section" aria-labelledby="tasks-heading"><div className="section-heading"><h2 id="tasks-heading">今日任务</h2><div className="section-heading__actions"><button className="text-button" disabled={busy} onClick={onInbox}><Inbox size={14} />收件箱{inboxCount ? ` ${inboxCount}` : ''}</button><span className="count-label">{active.filter(task => task.state === 'awaiting_acceptance').length > 0 ? `${active.filter(task => task.state === 'awaiting_acceptance').length} 待我验收 · ` : ''}{active.length} 未完成</span></div></div>
      <QuickCapture ref={quickRef} busy={busy} visible={visible} onAdd={onAdd} onCapture={onCapture} onRefine={onRefine} onCreateTask={onCreateTask} />
      <div className="task-list">{active.map(row)}{!active.length && <div className="empty-state"><strong>{unplanned.length ? '今天还没安排任务' : '今天还没有待执行任务'}</strong><span>{unplanned.length ? `待办池还有 ${unplanned.length} 项未完成任务，选好后即可开始。` : inboxCount ? '收件箱里已有想法，整理并确认后再加入今天。' : '直接在上方添加任务，保存后会自动加入今天。'}</span></div>}</div>
      {!!finished.length && <details className="completed-group" open={completedOpen} onToggle={event => setCompletedOpen(event.currentTarget.open)}><summary>今日已验收 {accepted}{finished.length > accepted ? ` · 已取消 ${finished.length - accepted}` : ''}</summary>{finished.map(row)}</details>}
      <button className="task-pool-entry" type="button" onClick={onPlan} disabled={busy} aria-label={unplanned.length ? '选择任务加入今天' : '安排今天'}><ListTodo size={17} /><span><strong>{unplanned.length ? '选择任务加入今天' : '安排今天'}</strong><small>{unplanned.length ? `待办池还有 ${unplanned.length} 项未完成任务` : '调整今日任务与备注'}</small></span><span className="task-pool-entry__action">安排<ChevronRight size={15} /></span></button>
    </section>
  </section>;
}

export function DailyPlanEditor({ snapshot, plans, initial, busy, onSave, onCreateTask, onInbox, onOpenTask }) {
  const initialIds = [...new Set(plans.flatMap(plan => plan.taskIds))];
  const [selected, setSelected] = useState(() => new Set((initial?.taskIds || initialIds).filter(id => snapshot.tasks.some(task => task.id === id))));
  const [note, setNote] = useState(initial?.note ?? plans[0]?.note ?? '');
  const active = snapshot.tasks.filter(task => !ended(task)), finished = snapshot.tasks.filter(task => ended(task) && initialIds.includes(task.id)), history = snapshot.tasks.filter(task => task.state === 'accepted' && !initialIds.includes(task.id));
  const allSelected = !!active.length && active.every(task => selected.has(task.id));
  const toggleAll = () => setSelected(current => { const next = new Set(current); active.forEach(task => allSelected ? next.delete(task.id) : next.add(task.id)); return next; });
  const option = (task, plannable = true) => <div key={task.id} className={`plan-task-option ${selected.has(task.id) ? 'is-selected' : ''} ${ended(task) ? 'is-completed' : ''}`}>
    <span className="plan-task-check-slot">{plannable ? <input id={`today-${task.id}`} type="checkbox" checked={selected.has(task.id)} disabled={busy} aria-label={`${selected.has(task.id) ? '从今日移除' : '加入今日'} ${task.title}`} onChange={event => setSelected(current => { const next = new Set(current); event.target.checked ? next.add(task.id) : next.delete(task.id); return next; })} /> : <Check size={15} />}</span>
    <div className="plan-task-option__main"><label className="plan-task-title" htmlFor={`today-${task.id}`} title={task.title}>{task.title}</label><small>{labels[task.state]} · {priorityLabels[task.priority]}{task.projectId ? ` · ${snapshot.projects.find(project => project.id === task.projectId)?.title || '项目'}` : ''}</small></div>
    <div className="plan-task-option__actions"><span className={`plan-task-state ${selected.has(task.id) ? 'is-selected' : ''}`}>{selected.has(task.id) ? '已加入今日' : task.state === 'accepted' ? '已验收' : task.state === 'cancelled' ? '已取消' : '未加入'}</span><button type="button" className="text-button" disabled={busy} onClick={() => onOpenTask(task.id, { taskIds: [...selected], note })} aria-label={`编辑任务 ${task.title}`}>详情<ChevronRight size={14} /></button></div>
  </div>;
  return <form onSubmit={event => { event.preventDefault(); onSave({ taskIds: [...selected], note }); }}><div className="task-editor__body">
    <p className="daily-plan-help"><ListTodo size={15} /><span><strong>从待办池安排今天</strong><small>勾选加入今日；取消勾选只从今日移除，任务仍保留在待办池。</small></span></p>
    <button type="button" className="plan-inbox-entry plan-create-task-entry" onClick={onCreateTask} disabled={busy}><Plus size={16} /><span><strong>新建任务</strong><small>填写定义，保存后加入今天</small></span><ChevronRight size={15} /></button>
    <button type="button" className="plan-inbox-entry" onClick={onInbox} disabled={busy}><Inbox size={16} /><span><strong>收件箱 {snapshot.inbox.filter(item => !item.archived).length}</strong><small>挑选想法，整理后加入今天</small></span><ChevronRight size={15} /></button>
    <section className="plan-task-panel"><header className="plan-task-panel__header"><span><strong>待办池</strong><small>已选 {active.filter(task => selected.has(task.id)).length} / {active.length} 项</small></span><button type="button" className="plan-task-bulk" disabled={busy || !active.length} onClick={toggleAll}>{allSelected ? '清空未完成' : '全部加入'}</button></header><div className="plan-task-list">{active.map(task => option(task))}{!active.length && <p className="empty-state compact">暂时没有未完成任务。</p>}</div></section>
    {!!finished.length && <section className="plan-task-panel"><header className="plan-task-panel__header"><strong>今日已结束 {finished.length}</strong></header><div className="plan-task-list">{finished.map(task => option(task))}</div></section>}
    {!!history.length && <details className="plan-task-panel"><summary className="plan-task-panel__header">历史已验收 {history.length}</summary><div className="plan-task-list">{history.map(task => option(task, false))}</div></details>}
    <Field label="今日备注" type="textarea" value={note} disabled={busy} onChange={setNote} />
  </div><footer className="task-editor__actions"><span className="selected-count">今日共 {selected.size} 项</span><button className="primary" type="submit" disabled={busy}>保存今日安排</button></footer></form>;
}
