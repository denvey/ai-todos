// Adapted from Xinmo Desktop TaskEditor.tsx: definition, advanced fields and AI workbench.
import { useEffect, useId, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Code2, Link2, Save, Sparkles, X } from 'lucide-react';
import { DatePickerField, SelectField } from './FormControls';
import { AiBadge } from './ExecutionView.jsx';
import { dateInput, fmt, hours, labels, parseSchedule, runtimeLabels } from '../format.js';

export function EditorDialog({ title, description, busy, error, onClose, children }) {
  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="task-editor-backdrop" />
    <Dialog.Content className="task-editor" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()}>
      <header className="task-editor__header"><div><Dialog.Title asChild><h2>{title}</h2></Dialog.Title><Dialog.Description className="muted">{description}</Dialog.Description></div><Dialog.Close asChild><button className="icon-button quiet" disabled={busy} aria-label="关闭对话框"><X size={18} /></button></Dialog.Close></header>
      {children}
      {error && <div className="editor-error" role="alert">{error}</div>}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}

export function Field({ label, value, onChange, type = 'text', action, hint, ...props }) {
  const id = useId();
  const inputProps = { id, value: value ?? '', onChange: event => onChange(event.target.value), ...(hint ? { 'aria-describedby': `${id}-hint` } : {}), ...props };
  return <div className="editor-field"><label htmlFor={id}>{label}</label><div className={`editor-field__control ${action ? 'has-action' : ''}`}>{type === 'textarea' ? <textarea {...inputProps} /> : <input type={type} onInput={type === 'time' ? event => onChange(event.currentTarget.value) : undefined} {...inputProps} />}{action}</div>{hint && <small id={`${id}-hint`}>{hint}</small>}</div>;
}

export function ScheduleFields({ values, setValue, disabled }) {
  return <div className="editor-field-pair"><DatePickerField label="计划开始" type="datetime-local" value={values.plannedStart} disabled={disabled} onValueChange={value => setValue('plannedStart', value)} /><DatePickerField label="计划结束" type="datetime-local" value={values.plannedEnd} disabled={disabled} onValueChange={value => setValue('plannedEnd', value)} /></div>;
}

export function Delivery({ task }) {
  const delivery = task.delivery;
  if (!delivery) return null;
  return <section className="dialog-section"><h3>交付证据</h3><p>{delivery.summary}</p>{delivery.evidence.map((evidence, index) => <div className="evidence" key={index}><strong>{evidence.label}</strong><p>{/^https?:\/\//.test(evidence.uri) ? <a href={evidence.uri} target="_blank" rel="noreferrer">{evidence.uri}</a> : <span className="mono">{evidence.uri}</span>}</p><p>{evidence.note}</p></div>)}<p className="muted">提交于 {fmt(delivery.submittedAt)}</p></section>;
}

export function TaskEditor({ task = {}, history = [], snapshot, busy, onSave, onRefine, onSyncProjects, onTransition, onBind, onSubmitDelivery, onReview, onFocus, onPrompt, onDelete }) {
  const creating = !task.id;
  const editable = creating || !['accepted', 'awaiting_acceptance', 'cancelled'].includes(task.state);
  const disabled = busy || !editable;
  const [values, setValues] = useState(() => ({ title: task.title || '', description: task.description || '', criteria: task.criteria || '', priority: task.priority || 'normal', projectId: task.projectId || '', keyResultId: task.keyResultId || '', remindAt: dateInput(task.remindAt), plannedStart: dateInput(task.plannedStart), plannedEnd: dateInput(task.plannedEnd) }));
  const [sessionId, setSessionId] = useState(task.sessionId || '');
  const [aiPreview, setAiPreview] = useState(null);
  const [refining, setRefining] = useState(null);
  const previewRef = useRef(null);
  useEffect(() => { if (aiPreview) previewRef.current?.scrollIntoView({ block: 'start' }); }, [aiPreview]);
  const setValue = (name, value) => { setAiPreview(null); setValues(current => ({ ...current, [name]: value })); };
  const improveDefinition = async field => {
    setRefining(field); setAiPreview(null);
    try { await onRefine({ title: values.title, description: values.description, criteria: values.criteria, projectId: values.projectId || null }, setAiPreview, field); }
    finally { setRefining(null); }
  };
  const aiAction = (field, label) => <button type="button" className="editor-field__ai" disabled={disabled || !values.title.trim()} onClick={() => improveDefinition(field)} aria-label={field === 'title' ? 'AI 完善标题与任务定义' : `AI 优化${label}`} title={field === 'title' ? '根据当前内容完善标题、任务说明和验收标准' : `结合当前标题、说明和验收标准优化${label}`}><Sparkles size={13} />{refining === field ? '生成中…' : field === 'title' ? 'AI 完善' : values[field].trim() ? 'AI 再优化' : 'AI 补齐'}</button>;
  const selectedProject = snapshot.projects.find(project => project.id === values.projectId);
  const groups = items => [{ options: items.map(([value, label]) => ({ value, label })) }];
  const transitions = { defining: ['ready', 'cancelled'], ready: ['defining', 'executing', 'cancelled'], executing: ['cancelled'], changes_requested: ['executing', 'cancelled'], accepted: ['defining'], cancelled: ['defining'], awaiting_acceptance: [] }[task.state] || [];
  return <form onSubmit={event => { event.preventDefault(); onSave({ title: values.title, description: values.description, criteria: values.criteria, priority: values.priority, projectId: values.projectId || null, keyResultId: values.keyResultId || null, remindAt: values.remindAt ? new Date(values.remindAt).toISOString() : null, ...parseSchedule(values) }); }}>
    <div className="task-editor__body">
      {!creating && <div className="row"><span className={`execution-status status-${task.state}`}>{labels[task.state]}</span><AiBadge task={{ ...task, ai: snapshot.tasks.find(item => item.id === task.id)?.ai }} /><span className="mono">r{task.revision}</span></div>}
      <Field label="任务名称" value={values.title} onChange={value => setValue('title', value)} required maxLength={300} disabled={disabled} autoFocus placeholder="输入任务，AI 可完善标题与定义" action={aiAction('title', '任务名称')} />
      {task.capture && <details className="editor-advanced"><summary><span><strong>收件箱原始想法</strong><small>{fmt(task.capture.capturedAt)}</small></span></summary><p className="editor-advanced__body">{task.capture.title}</p></details>}
      <fieldset className="editor-field priority-field" disabled={disabled}><legend>优先级</legend><div className="priority-segment">{[['low', '低'], ['normal', '普通'], ['high', '高']].map(([value, label]) => <button key={value} type="button" className={values.priority === value ? 'is-active' : ''} aria-pressed={values.priority === value} onClick={() => setValue('priority', value)}>{label}</button>)}</div></fieldset>
      <section className="task-definition"><header className="task-definition__header"><span><strong>任务说明与验收标准</strong><small>AI 根据当前填写的内容生成建议，应用后再保存。</small></span></header>
        {refining && <p className="task-definition__ai-note" role="status"><Sparkles size={13} />Codex 正在生成建议，请稍候。</p>}
        <Field label="任务说明" type="textarea" rows={3} value={values.description} onChange={value => setValue('description', value)} disabled={disabled} action={aiAction('description', '任务说明')} />
        <Field label="验收标准" type="textarea" rows={3} value={values.criteria} onChange={value => setValue('criteria', value)} disabled={disabled} placeholder="写下可观察、可核对的结果，才能设为就绪。" action={aiAction('criteria', '验收标准')} />
        {aiPreview && <section ref={previewRef} className="task-definition__ai-preview" aria-label="AI 优化预览"><header><span><strong>AI 优化建议</strong><small>确认前不会修改当前内容。</small></span></header><div className="task-definition__ai-diff">{[['title', '任务名称'], ['description', '任务说明'], ['criteria', '验收标准']].filter(([name]) => name in aiPreview).map(([name, label]) => <div key={name}><strong>{label}</strong><p><small>当前</small><span>{values[name] || '未填写'}</span></p><p className="is-suggested"><small>建议</small><span>{aiPreview[name]}</span></p></div>)}</div><footer><button type="button" className="text-button" disabled={busy} onClick={() => setAiPreview(null)}>暂不采用</button><button type="button" className="primary" disabled={busy} onClick={() => { setValues(current => ({ ...current, ...aiPreview })); setAiPreview(null); }}>应用优化</button></footer></section>}
      </section>
      <details className="editor-advanced"><summary><Link2 size={15} /><span><strong>排期与任务归属</strong><small>{values.plannedStart ? '已排期' : '未排期'} · {snapshot.projects.find(project => project.id === values.projectId)?.title || '无项目'}</small></span></summary><div className="editor-advanced__body">
        <ScheduleFields values={values} setValue={setValue} disabled={disabled} />
        <div className="editor-field-pair"><SelectField label="项目" value={values.projectId} onValueChange={value => setValue('projectId', value)} disabled={disabled} groups={groups([['', '无项目'], ...snapshot.projects.map(project => [project.id, `${project.title}${project.codex ? ' · Codex' : ''}`])])} /><SelectField label="关键结果" value={values.keyResultId} onValueChange={value => setValue('keyResultId', value)} disabled={disabled} groups={groups([['', '不关联 KR'], ...snapshot.keyResults.map(result => [result.id, result.title])])} /></div>
        {selectedProject?.codex && <p className="project-path">{selectedProject.codex.workspacePath}</p>}
        <button type="button" className="text-button" disabled={busy} onClick={onSyncProjects}>同步 Codex 项目</button>
        <DatePickerField label="提醒" type="datetime-local" value={values.remindAt} onValueChange={value => setValue('remindAt', value)} disabled={disabled} />
      </div></details>
      {!editable && <p className="note">当前状态保留审阅内容。需要更改请先退回或重新打开。</p>}
    {!creating && <div className="editor-details">
      <section className="dialog-section"><h3>推进任务</h3><div className="row">{transitions.map(state => <button type="button" key={state} className={state === 'cancelled' ? 'danger small' : 'small'} disabled={busy} onClick={() => onTransition(state)}>{state === 'defining' ? '重新定义' : state === 'ready' ? '设为就绪' : state === 'executing' ? '开始执行' : '取消任务'}</button>)}{task.state === 'executing' && <button type="button" className="primary small" disabled={busy} onClick={onSubmitDelivery}>提交交付</button>}{task.state === 'awaiting_acceptance' && <button type="button" className="primary small" disabled={busy} onClick={onReview}>审阅并验收 / 退回</button>}{!['accepted', 'cancelled'].includes(task.state) && snapshot.focus.status === 'idle' && <button type="button" className="small" disabled={busy} onClick={onFocus}>专注此任务</button>}</div><p className="muted">开始执行记录业务意图；AI 是否运行以可信 hook 事件为准。Stop 不改变交付状态。</p></section>
      <details className="codex-settings"><summary><Code2 size={15} /><span><strong>AI 会话关联</strong><small>{task.sessionId || '尚未关联'}</small></span></summary><div className="codex-settings__body"><code className="mono">任务 ID：{task.id}</code>{['defining', 'ready', 'changes_requested'].includes(task.state) && <><SelectField label="可信 AI 会话" value={sessionId} disabled={busy} onValueChange={setSessionId} groups={groups([['', '不关联'], ...snapshot.sessions.map(session => [session.id, `${session.id.slice(0, 8)} · ${runtimeLabels[session.state]} · ${session.cwd}`])])} /><button type="button" disabled={busy} onClick={() => onBind(sessionId || null)}>保存关联</button></>}<p className="muted">只接受插件 hooks 实际观察到的会话 ID。无会话时请审阅并信任 hooks，再开启新一轮对话。</p><button type="button" disabled={busy} onClick={onPrompt}>生成执行指令</button></div></details>
      <Delivery task={task} />
      {task.review && <section className="dialog-section"><h3>最近人工审阅</h3><p>{task.review.decision === 'accept' ? '验收通过' : '退回修改'} · {task.review.reviewer} · 实际审阅 r{task.review.reviewedRevision}</p><p className="muted">{task.review.note}</p></section>}
      <section className="dialog-section"><h3>任务历史</h3><ul className="history">{history.map((event, index) => <li key={index}><time>{fmt(event.at)}</time>{{ created: '创建任务', updated: '修改任务', transition: `推进到 ${labels[event.state]}`, bind: '关联可信会话', submit: '提交交付证据', review: event.decision === 'accept' ? '人工验收通过' : '人工退回修改', focus: `记录专注 ${hours(event.durationMs)}` }[event.type] || event.type}{event.note && <p>{event.note}</p>}{event.reviewedRevision && <span className="muted"> · 审阅 r{event.reviewedRevision}</span>}</li>)}</ul></section>
      {task.state === 'defining' && <div className="actions"><button type="button" disabled={busy} className="danger small" onClick={onDelete}>删除未执行任务</button></div>}
    </div>}
    </div>
    {editable && <footer className="task-editor__actions"><button className="primary" type="submit" disabled={busy}><Save size={16} />{busy ? refining ? '等待 AI 建议…' : '处理中…' : creating ? '创建任务' : '保存更改'}</button></footer>}
  </form>;
}
