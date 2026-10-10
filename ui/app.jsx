import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from '@modelcontextprotocol/ext-apps';
import { Plus, RefreshCw, Search, Settings } from 'lucide-react';
import { DatePickerField, SelectField } from './components/FormControls';
import { BoardView, ExecutionCard, TimelineView } from './components/ExecutionView.jsx';
import { TaskEditor, EditorDialog, Field, ScheduleFields, Delivery } from './components/TaskEditor.jsx';
import { GoalsView } from './components/GoalsView.jsx';
import { TodayView, DailyPlanEditor, dayPlans } from './components/TodayView.jsx';
import { InboxView } from './components/InboxView.jsx';
import { clock, dateInput, fmt, hours, labels, localDay, parseSchedule } from './format.js';
import { executionPrompt } from './codex-prompts.js';
import { visibleExecutionSessions, executionColumnForSession } from './execution-board.js';
import './xinmo.css';
import './style.css';

const localOrigin = '__AI_TODOS_ORIGIN__';
const embedded = window.parent !== window;
const bridge = embedded ? new App({ name: 'ai-todos', version: '0.1.5' }, {}, { autoResize: true }) : null;
function applyDisplayName(locale) {
  const chinese = /^zh(?:-|$)/i.test(locale || navigator.language);
  document.title = chinese ? '任务 · 工作台' : 'Todos · Workspace';
}
applyDisplayName();
const mainPages = { today: '首页', work: '任务', projects: '项目', okr: 'OKR' };
const pages = { ...mainPages, inbox: '收件箱', plans: '每日计划', settings: '设置' };
const singular = { task: '任务', project: '项目', objective: '目标', keyResult: '关键结果', plan: '计划' };
let csrf;
async function api(path, data) {
  if (embedded) {
    const names = { state: 'ai_todos_snapshot', command: 'ai_todos_manage', task: 'ai_todos_task', codex: 'ai_todos_codex', 'session-confirm': 'ai_todos_confirm_session' };
    if (!names[path]) throw new Error('人工审阅请打开本地应用。');
    const result = await bridge.callServerTool({ name: names[path], arguments: path === 'command' ? { command: data } : path === 'codex' ? { action: data } : (data ?? {}) });
    if (result.isError) throw new Error(result.content?.find(item => item.type === 'text')?.text || '工具调用失败');
    return result.structuredContent ?? JSON.parse(result.content.find(item => item.type === 'text').text);
  }
  const response = await fetch(`/api/${path}`, { method: data ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf || '' }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error);
  return value;
}
async function openLocal(id) {
  const url = `${localOrigin}/${id ? `#task=${id}` : ''}`;
  if (embedded) { const result = await bridge.openLink({ url }); if (result.isError) throw new Error(`宿主未允许打开本地链接，请手动打开 ${url}`); }
  else window.open(url, '_blank', 'noopener');
}
async function openCodexSession(id, prefillTask) {
  await api('codex', { operation: 'open_session', id, ...(prefillTask ? { prefillTask } : {}) });
}

function EntityForm({ kind, entity = {}, parent, snapshot, busy, onSave, onDelete }) {
  const [values, setValues] = useState(() => ({ ...entity, title: entity.title || '', description: entity.description || '', plannedStart: dateInput(entity.plannedStart), plannedEnd: dateInput(entity.plannedEnd), objectiveId: entity.objectiveId || parent || snapshot.objectives[0]?.id || '', unit: entity.unit || '', baseline: entity.baseline ?? 0, target: entity.target ?? 100, current: entity.current ?? 0, date: entity.date || localDay(new Date()), note: entity.note || '', taskIds: entity.taskIds || [] }));
  const setValue = (name, value) => setValues(current => ({ ...current, [name]: value }));
  return <form onSubmit={event => {
    event.preventDefault();
    const data = { title: values.title };
    if (entity.codex) delete data.title;
    if (['project', 'objective'].includes(kind)) data.description = values.description;
    if (kind === 'objective') Object.assign(data, parseSchedule(values));
    if (kind === 'keyResult') Object.assign(data, { objectiveId: values.objectiveId, unit: values.unit, baseline: Number(values.baseline), target: Number(values.target), current: Number(values.current) });
    if (kind === 'plan') Object.assign(data, { date: values.date, note: values.note, taskIds: values.taskIds });
    onSave(data);
  }}><div className="task-editor__body">
    <Field label="名称" value={values.title} onChange={value => setValue('title', value)} required maxLength={300} disabled={busy || !!entity.codex} autoFocus={!entity.codex} />
    {entity.codex && <p className="project-path">Codex · {entity.codex.workspacePath}<br />项目名称在 Codex 中维护，同步后更新。</p>}
    {['project', 'objective'].includes(kind) && <Field label="说明" type="textarea" value={values.description} onChange={value => setValue('description', value)} disabled={busy} />}
    {kind === 'objective' && <ScheduleFields values={values} setValue={setValue} disabled={busy} />}
    {kind === 'keyResult' && <><SelectField label="所属目标" value={values.objectiveId} disabled={busy} onValueChange={value => setValue('objectiveId', value)} groups={[{ options: snapshot.objectives.map(objective => ({ value: objective.id, label: objective.title })) }]} />
      <Field label="计量单位（可选）" value={values.unit} onChange={value => setValue('unit', value)} maxLength={40} disabled={busy} placeholder="例如：个、次、%、元" hint="用于显示进度，例如 20 / 100 个。百分比可填 %，起始值设为 0，目标值设为 100。" />
      <div className="form-grid">{[['baseline', '起始值'], ['target', '目标值'], ['current', '当前值']].map(([name, label]) => <Field key={name} label={label} type="number" value={values[name]} onChange={value => setValue(name, value)} required step="any" disabled={busy} />)}</div></>}
    {kind === 'plan' && <><DatePickerField label="计划日期" value={values.date} onValueChange={value => setValue('date', value)} disabled={busy} /><Field label="备注" type="textarea" value={values.note} onChange={value => setValue('note', value)} disabled={busy} />
      <section className="plan-task-panel"><header className="plan-task-panel__header"><span><strong>包含任务</strong><small>已选 {values.taskIds.length} 项</small></span></header><div className="plan-task-list">{snapshot.tasks.filter(task => task.state !== 'cancelled' || values.taskIds.includes(task.id)).map(task => {
        const selected = values.taskIds.includes(task.id);
        return <div key={task.id} className={`plan-task-option ${selected ? 'is-selected' : ''}`}><span className="plan-task-check-slot"><input type="checkbox" id={`plan-${task.id}`} checked={selected} disabled={busy} onChange={event => setValue('taskIds', event.target.checked ? [...values.taskIds, task.id] : values.taskIds.filter(id => id !== task.id))} /></span><div className="plan-task-option__main"><label className="plan-task-title" htmlFor={`plan-${task.id}`}>{task.title}</label><small>{labels[task.state]}</small></div></div>;
      })}{!snapshot.tasks.length && <p className="empty-state compact">先创建任务，再加入计划。</p>}</div></section></>}
    </div><footer className="task-editor__actions">{entity.id && <button type="button" className="danger" disabled={busy} onClick={onDelete}>删除</button>}<button type="submit" className="primary" disabled={busy}>{busy ? '保存中' : `保存${singular[kind]}`}</button></footer>
  </form>;
}

function DeliveryForm({ busy, onSave }) {
  const [values, setValues] = useState({ summary: '', label: '', uri: '', note: '' });
  return <form onSubmit={event => { event.preventDefault(); onSave({ summary: values.summary, evidence: [{ label: values.label, uri: values.uri, note: values.note }] }); }}><div className="task-editor__body">
    {[[ 'summary', '交付摘要', 'textarea' ], ['label', '证据名称'], ['uri', '证据 URL 或本地绝对路径'], ['note', '证据说明（验证命令与实际结果）', 'textarea']].map(([name, label, type]) => <Field key={name} label={label} type={type} value={values[name]} onChange={value => setValues(current => ({ ...current, [name]: value }))} required={name !== 'note'} maxLength={name === 'summary' ? 300 : undefined} disabled={busy} />)}
    <label className="check-label"><input type="checkbox" required disabled={busy} />我提交的是实际交付证据</label><p className="note">提交后进入待验收。文件路径供人工查阅，服务不会读取或执行文件。更多证据可通过 MCP 一次提交。</p></div><footer className="task-editor__actions"><button className="primary" type="submit" disabled={busy}>提交验收</button></footer>
  </form>;
}

function ReviewForm({ task, decision = 'accept', busy, onSave }) {
  const [values, setValues] = useState({ reviewer: '', decision, note: '', confirmed: false });
  return <form onSubmit={event => { event.preventDefault(); onSave(values); }}><div className="task-editor__body"><p className="note">正在审阅「{task.title}」的 r{task.revision}。请先检查验收标准与证据，再确认决定。</p><section className="dialog-section"><h3>验收标准</h3><p>{task.criteria}</p></section><Delivery task={task} />
    <Field label="审阅人" value={values.reviewer} onChange={value => setValues(current => ({ ...current, reviewer: value }))} required disabled={busy} />
    <SelectField label="审阅决定" value={values.decision} disabled={busy} onValueChange={value => setValues(current => ({ ...current, decision: value }))} groups={[{ options: [{ value: 'accept', label: '验收通过' }, { value: 'reject', label: '退回修改' }] }]} />
    <Field label="审阅说明（退回时必填）" type="textarea" value={values.note} onChange={value => setValues(current => ({ ...current, note: value }))} required={values.decision === 'reject'} disabled={busy} />
    <label className="check-label"><input type="checkbox" checked={values.confirmed} onChange={event => setValues(current => ({ ...current, confirmed: event.target.checked }))} required disabled={busy} />我已检查此版本的交付证据，并明确确认上述决定</label></div><footer className="task-editor__actions"><button type="submit" className="primary" disabled={busy}>记录人工决定</button></footer>
  </form>;
}

function SettingsForm({ settings, busy, onSave }) {
  const [values, setValues] = useState({ ...settings, reviewTime: settings.reviewTime || '' });
  return <form onSubmit={event => { event.preventDefault(); onSave({ reminders: values.reminders, followUpMinutes: Number(values.followUpMinutes), reviewTime: values.reviewTime || null, timezone: values.timezone }); }}><div className="task-editor__body">
    <label className="check-label"><input type="checkbox" checked={values.reminders} disabled={busy} onChange={event => setValues(current => ({ ...current, reminders: event.target.checked }))} />开启任务提醒</label>
    {[['followUpMinutes', '执行中任务跟进间隔（分钟，0 关闭）', 'number'], ['reviewTime', '每日复盘时间（留空关闭）', 'time'], ['timezone', '时区', 'text']].map(([name, label, type]) => <Field key={name} label={label} type={type} value={values[name]} disabled={busy} onChange={value => setValues(current => ({ ...current, [name]: value }))} required={name !== 'reviewTime'} min={name === 'followUpMinutes' ? 0 : undefined} max={name === 'followUpMinutes' ? 10080 : undefined} />)}</div><footer className="task-editor__actions"><button type="submit" className="primary" disabled={busy}>保存配置</button></footer>
  </form>;
}

function dailyTotals(snapshot) {
  const totals = new Map();
  const addSegment = (taskId, start, end) => {
    let cursor = new Date(start).getTime(); const stop = new Date(end).getTime();
    while (cursor < stop) {
      const day = localDay(new Date(cursor)), next = new Date(cursor); next.setHours(24, 0, 0, 0);
      const limit = Math.min(stop, next.getTime()), key = `${day}:${taskId}`;
      totals.set(key, { day, taskId, ms: (totals.get(key)?.ms || 0) + limit - cursor }); cursor = limit;
    }
  };
  snapshot.timeRecords.forEach(record => record.segments.forEach(segment => addSegment(record.taskId, segment.start, segment.end)));
  snapshot.focus.segments.forEach(segment => addSegment(snapshot.focus.taskId, segment.start, segment.end));
  if (snapshot.focus.startedAt) addSegment(snapshot.focus.taskId, snapshot.focus.startedAt, snapshot.serverTime);
  return [...totals.values()];
}

function Workspace() {
  const [snapshot, setSnapshot] = useState(null);
  const [connectionError, setConnectionError] = useState('');
  const [threadTransport, setThreadTransport] = useState(null);
  const [view, setView] = useState({ page: 'today', mode: 'board', project: '', search: '' });
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [, setTick] = useState(0);
  const [focusTaskId, setFocusTaskId] = useState('');
  const [statsDate, setStatsDate] = useState(localDay(new Date()));
  const receivedAt = useRef(Date.now()), snapshotRef = useRef(null), refreshing = useRef(null), busyRef = useRef(false), modalRef = useRef(null), toastTimer = useRef(null), syncingThreads = useRef(null), lastThreadSync = useRef(0);
  modalRef.current = modal;
  const toast = value => { setMessage(value); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setMessage(''), 6000); };
  const refresh = async (force = false) => {
    if (refreshing.current) { if (!force) return refreshing.current; await refreshing.current.catch(() => {}); }
    const pending = api('state').then(next => { csrf = next.csrf; receivedAt.current = Date.now(); snapshotRef.current = next; setSnapshot(next); setConnectionError(''); return next; });
    refreshing.current = pending;
    try { return await pending; } finally { if (refreshing.current === pending) refreshing.current = null; }
  };
  const mutate = async command => { const value = await api('command', command); await refresh(true); return value; };
  const run = async (action, success, close = false) => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError('');
    try { await action(); if (close) setModal(modalRef.current?.returnTo || null); if (success) toast(success); return true; }
    catch (reason) { if (modalRef.current) setError(reason.message); else toast(reason.message); return false; }
    finally { busyRef.current = false; setBusy(false); }
  };
  const open = value => { setError(''); setModal({ ...value, key: crypto.randomUUID() }); };
  const openTask = (id, returnTo) => run(async () => { const detail = await api('task', { id }); open({ type: 'task', ...detail, returnTo }); });
  const openEntity = (kind, entity, parent) => open({ type: kind === 'task' ? 'task' : 'entity', kind, entity, parent, requestId: crypto.randomUUID() });
  const deleteEntity = (kind, entity) => open({ type: 'delete', kind, entity, returnTo: modalRef.current?.returnTo });
  const focusOp = (operation, taskId) => run(async () => { if (operation === 'start' && !taskId) throw new Error('请先选择专注任务'); await mutate({ action: 'focus', operation, revision: snapshotRef.current.focus.revision, ...(operation === 'start' ? { taskId } : {}) }); }, undefined, !!modalRef.current);
  const transition = (id, revision, state, close = false) => run(() => mutate({ action: 'transition', id, revision, state }), '任务状态已更新', close);
  const reschedule = (task, days, edge) => run(async () => {
    if (['accepted', 'awaiting_acceptance'].includes(task.state)) throw new Error('请先退回或重新打开任务，再调整排期。');
    const start = Date.parse(task.plannedStart) + (edge === 'end' ? 0 : days * 86400000), end = Date.parse(task.plannedEnd) + (edge === 'start' ? 0 : days * 86400000);
    await mutate({ action: 'update', kind: 'task', id: task.id, revision: task.revision, data: { plannedStart: new Date(start).toISOString(), plannedEnd: new Date(end).toISOString() } });
  }, '排期已保存');
  const review = (task, decision = 'accept') => run(async () => {
    if (embedded) { await openLocal(task.id); toast('请在本地应用中打开交付证据并明确确认。'); return; }
    const detail = await api('review-ticket', { id: task.id, revision: task.revision });
    open({ type: 'review', ...detail, decision, returnTo: modalRef.current?.returnTo });
  });
  const prompt = id => run(async () => { const { task } = await api('task', { id }); open({ type: 'prompt', text: executionPrompt(task), returnTo: modalRef.current?.returnTo }); });
  const openCodex = task => run(async () => {
    const { sessionId, prefillTask } = await api('codex', { operation: 'prepare_task_session', id: task.id, revision: task.revision });
    await openCodexSession(sessionId, prefillTask);
    await refresh(true);
    if (modalRef.current?.type === 'task' && modalRef.current.task?.id === task.id && !task.sessionId) {
      const detail = await api('task', { id: task.id });
      open({ type: 'task', ...detail, returnTo: modalRef.current.returnTo });
    }
  });
  const syncProjects = () => run(async () => {
    const result = await api('codex', { operation: 'sync_projects' });
    await refresh(true); toast(`已同步 ${result.count} 个 Codex 项目目录，新增 ${result.added} 个，更新 ${result.updated} 个。`);
  });
  const syncThreads = async () => {
    if (syncingThreads.current) return syncingThreads.current;
    const pending = api('codex', { operation: 'sync_threads' }); syncingThreads.current = pending;
    try { const result = await pending; setThreadTransport(result.transport); lastThreadSync.current = Date.now(); await refresh(true); return result; }
    finally { if (syncingThreads.current === pending) syncingThreads.current = null; }
  };
  const syncWorkspace = () => run(async () => {
    const result = await syncThreads(); toast(`已更新 Codex 会话目录，共 ${result.count} 个（含历史会话）。${result.transport === 'history' ? '宿主实时接口不可用，运行状态由可信 hooks 补充。' : ''}`);
  });
  const openSession = id => run(() => openCodexSession(id));
  const confirmSession = session => run(async () => {
    await api('session-confirm', { id: session.id, observedAt: session.observedAt, event: session.event, turnId: session.turnId ?? null, catalogUpdatedAt: session.catalogUpdatedAt ?? null, confirmed: true });
    await refresh(true);
  }, '会话已确认完成');
  const createToday = (draft, onCreated) => open({ type: 'task', draft, onCreated, planDate: localDay(new Date()), requestId: crypto.randomUUID() });
  const addToday = (data, requestId) => run(() => mutate({ action: 'create_tasks', data, requestId, planDate: localDay(new Date()) }), data.length > 1 ? `已拆成 ${data.length} 项今日任务` : '任务已加入今天');
  const captureInbox = (title, requestId) => run(() => mutate({ action: 'create', kind: 'inbox', data: { title }, requestId }), '已记入收件箱，不计入待办和逾期');
  const refineCapture = (draft, receive) => run(async () => receive(await api('codex', { operation: 'capture_refine', draft })), 'AI 已完善草稿，请确认后保存');
  const openInbox = () => { setModal(null); setView(current => ({ ...current, page: 'inbox' })); };
  const promoteInbox = async (item, data, today, openAfter, requestId) => {
    let promoted;
    const completed = await run(async () => { promoted = await mutate({ action: 'promote', id: item.id, revision: item.revision, data, requestId, ...(today ? { planDate: localDay(new Date()) } : {}) }); }, today ? '已转为任务并加入今天' : '已从收件箱转为任务');
    if (completed && openAfter) await openTask(promoted.id);
    return completed;
  };
  const focusTask = task => {
    const focus = snapshotRef.current.focus;
    return focus.taskId === task.id && focus.status !== 'idle' ? focusOp(focus.status === 'running' ? 'pause' : 'resume') : focusOp('start', task.id);
  };
  const taskAction = task => ['accepted', 'cancelled'].includes(task.state) ? transition(task.id, task.revision, 'defining') : task.state === 'awaiting_acceptance' ? review(task) : openTask(task.id);

  useEffect(() => {
    let stopped = false, poll, timer;
    let notified = new Set();
    const boot = async () => {
      try {
        if (embedded) {
          const applyHostContext = context => { if (context?.locale) applyDisplayName(context.locale); if (context?.theme) applyDocumentTheme(context.theme); if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables); if (context?.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts); };
          bridge.onhostcontextchanged = applyHostContext;
          bridge.ontoolresult = result => { if (result.structuredContent?.tasks) refresh(true).catch(reason => toast(reason.message)); };
          await bridge.connect(); applyHostContext(bridge.getHostContext());
        }
        if (stopped) return;
        const next = await refresh(true); notified = new Set(next.notices.map(notice => notice.id));
        try { await api('codex', { operation: 'sync_projects' }); if (!stopped) await refresh(true); }
        catch (reason) { if (!stopped) toast(`Codex 项目未同步：${reason.message}`); }
        try { await syncThreads(); } catch (reason) { if (!stopped) toast(`Codex 会话未同步：${reason.message}`); }
        const id = location.hash.match(/^#task=([a-f0-9-]+)$/)?.[1]; if (id) await openTask(id);
      } catch (reason) { setConnectionError(reason.message); }
      if (stopped) return;
      timer = setInterval(() => setTick(value => value + 1), 1000);
      poll = setInterval(async () => {
        try {
          if (Date.now() - lastThreadSync.current > 30000) { lastThreadSync.current = Date.now(); try { await syncThreads(); } catch (reason) { toast(`Codex 会话未同步：${reason.message}`); } }
          const next = await refresh();
          if (!embedded && 'Notification' in window && Notification.permission === 'granted') next.notices.filter(notice => !notice.read && !notified.has(notice.id)).forEach(notice => { new Notification('ai-todos', { body: notice.title }); notified.add(notice.id); });
        } catch (reason) { setConnectionError(reason.message); }
      }, 5000);
    };
    boot();
    return () => { stopped = true; clearInterval(timer); clearInterval(poll); clearTimeout(toastTimer.current); };
  }, []);

  if (!snapshot) return <div className="loading"><h1>{connectionError ? '工作台尚未连接' : '正在连接本地工作台…'}</h1>{connectionError && <><p>{connectionError}</p><p>本地应用：<a href={localOrigin}>{localOrigin}</a></p></>}</div>;
  const setViewValue = (name, value) => setView(current => ({ ...current, [name]: value }));
  const findTask = id => snapshot.tasks.find(task => task.id === id);
  const projectName = id => snapshot.projects.find(project => project.id === id)?.title || '无项目';
  const filtered = snapshot.tasks.filter(task => (!view.project || task.projectId === view.project) && (!view.search || `${task.title} ${task.description}`.toLowerCase().includes(view.search.toLowerCase())));
  const filteredSessions = visibleExecutionSessions(snapshot.sessions, snapshot.tasks).filter(session => session.catalogVisible !== false && (!view.project || snapshot.projects.find(project => project.id === view.project)?.codex?.workspacePath === session.cwd) && (!view.search || `${session.title || ''} ${session.preview || ''}`.toLowerCase().includes(view.search.toLowerCase()))).sort((a, b) => (b.catalogUpdatedAt || b.observedAt).localeCompare(a.catalogUpdatedAt || a.observedAt));
  const boardSessionCount = filteredSessions.filter(session => executionColumnForSession(session) !== null).length;
  const elapsedMs = snapshot.focus.totalMs + (snapshot.focus.status === 'running' ? Math.max(0, Date.now() - receivedAt.current) : 0);
  const focusCandidates = snapshot.tasks.filter(task => !['accepted', 'cancelled'].includes(task.state));
  const selectedFocusTask = focusCandidates.find(task => task.id === focusTaskId);
  const totals = view.page === 'today' ? dailyTotals(snapshot) : [], dayRows = totals.filter(row => row.day === statsDate);
  const mainPage = ['inbox', 'plans'].includes(view.page) ? 'today' : view.page;
  let modalTitle, modalDescription, modalBody;
  if (modal) {
    const task = modal.task, entity = modal.entity || {};
    if (modal.type === 'task') {
      modalTitle = task?.title || '新建任务'; modalDescription = task ? `本次实际审阅版本 r${task.revision}` : '保存到本地持久化数据库';
      modalBody = <TaskEditor task={task || modal.draft} history={modal.history} snapshot={snapshot} busy={busy}
        onRefine={(draft, receive, field) => run(async () => receive(await api('codex', { operation: 'refine', draft, ...(field ? { field } : {}) })))} onSyncProjects={syncProjects}
        onSave={data => run(async () => { await mutate(task ? { action: 'update', kind: 'task', id: task.id, revision: task.revision, data } : { action: 'create', kind: 'task', data, requestId: modal.requestId, ...(modal.planDate ? { planDate: modal.planDate } : {}) }); modal.onCreated?.(); }, modal.planDate ? '任务已加入今天' : '任务已保存', true)}
        onTransition={state => transition(task.id, task.revision, state, true)}
        onBind={sessionId => run(async () => { await mutate({ action: 'bind', id: task.id, revision: task.revision, sessionId }); const detail = await api('task', { id: task.id }); open({ type: 'task', ...detail, returnTo: modal.returnTo }); }, '关联已保存')}
        onSubmitDelivery={() => open({ type: 'delivery', task, returnTo: modal.returnTo })} onReview={() => review(task)} onFocus={() => focusOp('start', task.id)} onPrompt={() => prompt(task.id)} onOpenCodex={() => openCodex(task)} onDelete={() => deleteEntity('task', task)} />;
    } else if (modal.type === 'daily_plan') {
      modalTitle = '安排今天'; modalDescription = `${modal.date} · 勾选任务加入今天`;
      modalBody = <DailyPlanEditor snapshot={snapshot} plans={modal.plans} initial={modal.draft} busy={busy} onCreateTask={() => createToday()} onInbox={openInbox}
        onOpenTask={(id, draft) => openTask(id, { ...modal, draft })}
        onSave={data => run(() => mutate({ action: 'daily_plan', date: modal.date, plans: modal.plans.map(({ id, revision }) => ({ id, revision })), ...data }), '今日安排已保存', true)} />;
    } else if (modal.type === 'entity') {
      modalTitle = `${entity.id ? '编辑' : '新建'}${singular[modal.kind]}`; modalDescription = entity.id ? `当前审阅版本 r${entity.revision}` : '保存到本地持久化数据库';
      modalBody = <EntityForm kind={modal.kind} entity={entity} parent={modal.parent} snapshot={snapshot} busy={busy} onDelete={() => deleteEntity(modal.kind, entity)} onSave={data => run(() => mutate(entity.id ? { action: 'update', kind: modal.kind, id: entity.id, revision: entity.revision, data } : { action: 'create', kind: modal.kind, data, requestId: modal.requestId }), `${singular[modal.kind]}已保存`, true)} />;
    } else if (modal.type === 'delivery') {
      modalTitle = '提交真实交付'; modalDescription = `提交基于实际审阅 r${task.revision}`;
      modalBody = <DeliveryForm busy={busy} onSave={data => run(() => mutate({ action: 'submit', id: task.id, revision: task.revision, ...data }), '已提交，等待人工审阅', true)} />;
    } else if (modal.type === 'review') {
      modalTitle = '人工审阅交付'; modalDescription = `实际审阅版本 r${task.revision} · 若任务改变，此确认会被拒绝`;
      modalBody = <ReviewForm task={task} decision={modal.decision} busy={busy} onSave={data => run(async () => { await api('review', { ticket: modal.ticket, id: task.id, revision: task.revision, ...data }); await refresh(true); }, '已记录人工决定', true)} />;
    } else if (modal.type === 'settings') {
      modalTitle = '提醒设置'; modalDescription = `当前审阅版本 r${modal.settings.revision}`;
      modalBody = <SettingsForm settings={modal.settings} busy={busy} onSave={data => run(() => mutate({ action: 'settings', revision: modal.settings.revision, data }), '配置已保存', true)} />;
    } else if (modal.type === 'delete') {
      modalTitle = '确认删除'; modalDescription = entity.title;
      modalBody = <div className="editor-details"><p>只有未执行且没有引用和时间记录的数据可以删除。已有执行记录的任务请取消。</p><div className="actions"><button disabled={busy} onClick={() => setModal(null)}>取消</button><button className="danger" disabled={busy} onClick={() => run(() => mutate({ action: 'delete', kind: modal.kind, id: entity.id, revision: entity.revision }), '已删除', true)}>确认删除</button></div></div>;
    } else if (modal.type === 'prompt') {
      modalTitle = '交给 Codex 执行'; modalDescription = '发送指令不代表任务已经运行或交付。';
      modalBody = <div className="editor-details"><p className="note">指令包含原任务 ID 和可信会话核对要求。</p><textarea aria-label="执行指令" readOnly value={modal.text} className="execution-prompt" /><div className="actions"><button disabled={busy} onClick={() => run(async () => { try { await navigator.clipboard.writeText(modal.text); toast('执行指令已复制'); } catch { document.querySelector('.execution-prompt').select(); toast('请使用复制快捷键复制选中的指令'); } })}>复制指令</button>{embedded && <button className="primary" disabled={busy} onClick={() => run(async () => { const result = await bridge.sendMessage({ role: 'user', content: [{ type: 'text', text: modal.text }] }); if (result.isError) throw new Error('宿主拒绝发送，请复制指令到原会话'); }, '执行指令已交给当前对话', true)}>发送到当前对话</button>}</div></div>;
    }
  }
  return <><main className={`main ${view.page === 'work' && view.mode === 'board' ? 'is-board' : ''} ${snapshot.focus.status !== 'idle' ? 'has-focus' : ''}`}>
    <nav className="nav" aria-label="功能导航">{Object.entries(mainPages).map(([page, label]) => <button key={page} disabled={busy} aria-current={mainPage === page ? 'page' : undefined} className={mainPage === page ? 'active' : ''} onClick={() => setViewValue('page', page)}>{label}</button>)}<button className={`nav-settings ${view.page === 'settings' ? 'active' : ''}`} disabled={busy} aria-current={view.page === 'settings' ? 'page' : undefined} onClick={() => setViewValue('page', 'settings')}><Settings size={16} aria-hidden="true" />设置</button></nav>
    <header className="page-header"><div className="row">{['inbox', 'plans'].includes(view.page) && <><button className="quiet small" disabled={busy} onClick={() => setViewValue('page', 'today')}>首页</button><span className="muted" aria-hidden="true">/</span></>}<h1>{pages[view.page]}</h1></div><div className="row">{embedded && <button className="quiet small" disabled={busy} onClick={() => run(() => openLocal())}>打开完整应用</button>}{view.page === 'today' && <button className="quiet small" disabled={busy} onClick={() => setViewValue('page', 'plans')}>每日计划</button>}{view.page === 'projects' && <button className="quiet small" disabled={busy} onClick={syncProjects}><RefreshCw size={14} />同步 Codex 项目</button>}<button className="quiet small" disabled={busy} onClick={view.page === 'work' ? syncWorkspace : () => run(() => refresh(true))}><RefreshCw size={14} />刷新</button>{['work', 'projects', 'okr', 'plans'].includes(view.page) && <button className="primary" disabled={busy} onClick={() => openEntity({ work: 'task', projects: 'project', okr: 'objective', plans: 'plan' }[view.page])}><Plus size={15} />{`新建${singular[{ work: 'task', projects: 'project', okr: 'objective', plans: 'plan' }[view.page]]}`}</button>}</div></header>
    {connectionError && <p className="error" role="alert">连接暂不可用：{connectionError}</p>}
    {view.page === 'today' && <section className="card home-focus" aria-labelledby="focus-stats-title"><div className="row spaced"><h2 id="focus-stats-title">专注统计</h2><DatePickerField label="统计日期" value={statsDate} onValueChange={setStatsDate} /></div><div className="summary"><div><p>{statsDate === localDay(new Date()) ? '今日投入' : '选定日期投入'}</p><div className="number">{hours(dayRows.reduce((sum, row) => sum + row.ms, 0))}</div></div><div><p>累计投入</p><div className="number">{hours(totals.reduce((sum, row) => sum + row.ms, 0))}</div></div><div><p>已保存专注记录</p><div className="number">{snapshot.timeRecords.length}</div></div></div>
      <details><summary>查看专注明细</summary>
        {snapshot.focus.status === 'idle' && <div className="row focus-picker"><SelectField label="专注任务" value={focusTaskId} disabled={busy || !focusCandidates.length} onValueChange={setFocusTaskId} groups={[{ options: [{ value: '', label: '选择任务' }, ...focusCandidates.map(task => ({ value: task.id, label: task.title }))] }]} /><button className="small" disabled={busy || !selectedFocusTask} onClick={() => focusOp('start', focusTaskId)}>开始专注</button></div>}
        <div className="table-wrap"><table><thead><tr><th>任务</th><th>项目</th><th>投入时间</th></tr></thead><tbody>{dayRows.map(row => <tr key={row.taskId}><td>{findTask(row.taskId)?.title}</td><td>{projectName(findTask(row.taskId)?.projectId)}</td><td>{hours(row.ms)}</td></tr>)}{!dayRows.length && <tr><td colSpan={3} className="muted">选定日期暂无时间记录。</td></tr>}</tbody></table></div>
        <h3 className="section-title">按项目累计</h3><div className="grid">{[...new Set(totals.map(row => findTask(row.taskId)?.projectId || ''))].map(projectId => <div className="card" key={projectId}><h3>{projectName(projectId)}</h3><div className="number">{hours(totals.filter(row => (findTask(row.taskId)?.projectId || '') === projectId).reduce((sum, row) => sum + row.ms, 0))}</div></div>)}</div><h3 className="section-title">最近记录</h3><div className="list">{snapshot.timeRecords.slice(-20).reverse().map(record => <div className="row spaced" key={record.id}><span>{findTask(record.taskId)?.title}</span><span className="muted">{fmt(record.endedAt)} · {hours(record.durationMs)}</span></div>)}</div>
        <p className="note">关闭面板不会停止计时。设备休眠或服务退出期间，运行中的计时仍按墙钟累计；离开前请暂停。</p>
      </details></section>}
    <TodayView snapshot={snapshot} busy={busy} visible={view.page === 'today'} elapsedMs={elapsedMs} onAdd={addToday} onCapture={captureInbox} onRefine={refineCapture} onCreateTask={createToday} onOpenTask={openTask} onTaskAction={taskAction} onFocusTask={focusTask} onFocusOp={focusOp} onInbox={openInbox} onPlan={() => { const date = localDay(new Date()); open({ type: 'daily_plan', date, plans: dayPlans(snapshot.plans, date) }); }} />
    <InboxView items={snapshot.inbox} visible={view.page === 'inbox'} busy={busy} onClose={() => setViewValue('page', 'today')} onCapture={captureInbox} onRefine={refineCapture} onPromote={promoteInbox} onArchive={(item, archived) => run(() => mutate({ action: 'update', kind: 'inbox', id: item.id, revision: item.revision, data: { archived } }), archived ? '已归档，可在收件箱底部恢复' : '已恢复到收件箱')} />
    {view.page === 'work' && <section className={`execution-view ${view.mode === 'board' ? 'is-board' : ''}`}><div className="execution-toolbar"><div className="row"><div className="segmented-control">{[['board', '看板'], ['timeline', '时间线']].map(([mode, label]) => <button key={mode} className={view.mode === mode ? 'is-active' : ''} aria-pressed={view.mode === mode} onClick={() => setViewValue('mode', mode)}>{label}</button>)}</div><span className="muted">{filtered.length} 项任务 · {boardSessionCount} 个看板会话</span></div><div className="execution-filters"><SelectField label="项目" value={view.project} onValueChange={value => setViewValue('project', value)} disabled={!snapshot.projects.length} groups={[{ options: [{ value: '', label: '全部项目' }, ...snapshot.projects.map(project => ({ value: project.id, label: project.title }))] }]} /><label className="task-search"><Search size={14} aria-hidden="true" /><input type="search" aria-label="搜索任务" placeholder="搜索任务…" value={view.search} onChange={event => setViewValue('search', event.target.value)} /></label></div></div>
      {threadTransport === 'history' && !snapshot.sessions.some(session => session.source === 'codex-hook') && <p className="note" role="status">实时状态尚未接通，当前只同步了历史会话。请在终端运行 <code>codex</code>，输入 <code>/hooks</code>，审阅并信任 ai-todos 插件的 hooks。然后重新打开需要跟踪的会话；收到运行事件后会自动显示在“进行中”。</p>}
      {view.mode === 'board' ? <BoardView tasks={filtered} allTasks={snapshot.tasks} sessions={filteredSessions} onOpenSession={openSession} onConfirmSession={confirmSession} onReviewTask={review} projects={snapshot.projects} busy={busy} onOpenTask={openTask} onOpenCodex={openCodex} onTransition={transition} onError={toast} /> : <TimelineView tasks={filtered} projects={snapshot.projects} busy={busy} onOpenTask={openTask} onOpenSession={openSession} onReviewTask={review} onOpenCodex={openCodex} onReschedule={reschedule} />}
      {filtered.some(task => task.state === 'cancelled') && <details><summary className="muted">已取消（{filtered.filter(task => task.state === 'cancelled').length}）</summary><div className="grid">{filtered.filter(task => task.state === 'cancelled').map(task => <ExecutionCard key={task.id} task={task} projects={snapshot.projects} busy={busy} onOpenTask={openTask} />)}</div></details>}
    </section>}
    {view.page === 'projects' && <div className="grid">{snapshot.projects.map(project => {
      const tasks = snapshot.tasks.filter(task => task.projectId === project.id), accepted = tasks.filter(task => task.state === 'accepted').length;
      return <article className="card" key={project.id}><div className="row spaced"><h2>{project.title}</h2><button className="small" disabled={busy} onClick={() => openEntity('project', project)}>编辑</button></div>{project.codex && <p className="project-path">Codex · {project.codex.workspacePath}</p>}<p className="muted">{project.description || '还没有项目说明。'}</p><div className="progress-track"><span style={{ width: `${tasks.length ? accepted / tasks.length * 100 : 0}%` }} /></div><div className="row spaced"><span className="muted">{accepted} / {tasks.length} 已验收</span><button className="small" onClick={() => setView(current => ({ ...current, page: 'work', project: project.id }))}>查看任务</button></div></article>;
    })}{!snapshot.projects.length && <div className="empty-state"><strong>按项目组织工作</strong><span>项目、看板和时间线共享同一组任务。</span></div>}</div>}
    {view.page === 'okr' && <GoalsView snapshot={snapshot} busy={busy} onEdit={openEntity} onNew={(kind, parent) => openEntity(kind, null, parent)} onOpenTask={openTask} />}
    {view.page === 'plans' && <div className="list"><p className="muted">按日期安排已有任务，可查看和编辑不同日期的任务清单；当天安排会显示在首页。</p>{[...snapshot.plans].sort((left, right) => right.date.localeCompare(left.date)).map(plan => <article className="card" key={plan.id}><div className="row spaced"><div><span className="muted">{plan.date}</span><h2>{plan.title}</h2></div><button className="small" disabled={busy} onClick={() => openEntity('plan', plan)}>编辑计划</button></div><p className="muted">{plan.note}</p><div className="list">{plan.taskIds.map(id => <div className="row spaced" key={id}><button className="quiet" onClick={() => openTask(id)}>{findTask(id)?.title || '任务已删除'}</button><span className="execution-status">{labels[findTask(id)?.state] || '未知'}</span></div>)}{!plan.taskIds.length && <span className="muted">尚未选择任务。</span>}</div></article>)}{!snapshot.plans.length && <div className="empty-state"><strong>让今天有一个明确计划</strong><span>选择现有任务，添加日期和备注。计划不会复制任务。</span></div>}</div>}
    {view.page === 'settings' && <div className="grid"><section className="card"><div className="row spaced"><h2>提醒设置</h2><button className="small" disabled={busy} onClick={() => open({ type: 'settings', settings: { ...snapshot.settings } })}>编辑提醒设置</button></div><p className="muted">任务提醒：{snapshot.settings.reminders ? '开启' : '关闭'}<br />进度跟进：{snapshot.settings.followUpMinutes ? `每 ${snapshot.settings.followUpMinutes} 分钟` : '关闭'}<br />每日复盘：{snapshot.settings.reviewTime || '关闭'}<br />时区：{snapshot.settings.timezone}</p>{!embedded && <button className="small" onClick={() => run(async () => { if (!('Notification' in window)) throw new Error('当前浏览器不支持系统通知，提醒仍保存在提醒记录。'); const permission = await Notification.requestPermission(); toast(permission === 'granted' ? '已允许页面打开时显示浏览器通知' : '通知未启用，提醒仍保存在提醒记录'); })}>允许浏览器通知</button>}<p className="note">本地服务每 15 秒检查并保存到期提醒。停机或休眠期间不调度，恢复后补当前提醒。浏览器通知需要页面打开及权限，不会自动唤醒 AI。</p></section><section className="card"><h2>提醒记录</h2><p className="muted">{snapshot.notices.filter(notice => !notice.read).length} 条未读</p><div className="list">{snapshot.notices.map(notice => <article className={`notice ${notice.read ? 'read' : ''}`} key={notice.id}><div className="row spaced"><h3>{notice.title}</h3>{!notice.read ? <button className="small" disabled={busy} onClick={() => run(() => mutate({ action: 'ack', id: notice.id }))}>已读</button> : <span className="muted">已读</span>}</div><p className="muted">{fmt(notice.createdAt)}</p><button className="small" onClick={() => notice.taskId ? openTask(notice.taskId) : setViewValue('page', 'today')}>{notice.taskId ? '打开任务' : '查看今日安排'}</button></article>)}{!snapshot.notices.length && <span className="muted">目前没有提醒。</span>}</div></section></div>}
  </main>
    {snapshot.focus.status !== 'idle' && view.page !== 'today' && <div className="focus-bar"><div><span className="execution-status">{snapshot.focus.status === 'running' ? '正在专注' : '已暂停'}</span> <span>{findTask(snapshot.focus.taskId)?.title}</span><strong>{clock(elapsedMs)}</strong></div><div className="row"><button className="small" disabled={busy} onClick={() => focusOp(snapshot.focus.status === 'running' ? 'pause' : 'resume')}>{snapshot.focus.status === 'running' ? '暂停' : '继续'}</button><button className="small" disabled={busy} onClick={() => focusOp('finish')}>结束并记录</button></div></div>}
    {modal && <EditorDialog key={modal.key} title={modalTitle} description={modalDescription} busy={busy} error={error} onClose={() => setModal(modal.returnTo || null)}>{modalBody}</EditorDialog>}
    {message && <div className="toast" role="status" aria-live="polite">{message}</div>}
  </>;
}

createRoot(document.querySelector('#app')).render(<Workspace />);
