// Adapted from Xinmo Desktop ExecutionView.tsx: callbacks replace desktop backend calls.
import { useRef, useState } from 'react';
import { CalendarRange, ChevronDown, ListTodo } from 'lucide-react';
import { fmt, labels, priorityLabels, runtimeLabels } from '../format.js';

export const boardColumns = [
  { id: 'unstarted', label: '未开始', states: ['defining', 'ready', 'changes_requested'], dropTarget: 'ready' },
  { id: 'executing', label: '进行中', states: ['executing'], dropTarget: 'executing' },
  { id: 'waiting_user', label: '需要你处理', states: ['awaiting_acceptance'], dropTarget: 'awaiting_acceptance' },
  { id: 'completed', label: '已完成', states: ['accepted'], dropTarget: 'accepted' },
];

export function AiBadge({ task }) {
  return <span className={`execution-status status-${task.ai?.state || 'unknown'}`} title={task.ai ? `来源：Codex hook · ${fmt(task.ai.observedAt)} · ${task.ai.event}` : '启用并信任 hooks 后可观察；业务执行中不代表 AI 正在运行'}>
    {task.sessionId ? runtimeLabels[task.ai?.state || 'unknown'] : '未关联 AI'}
  </span>;
}

export function ExecutionCard({ task, projects, busy, onOpenTask, onDragStart, onDragEnd }) {
  const [expanded, setExpanded] = useState(false);
  const dragged = useRef(false);
  return <article className="execution-card" draggable={!!onDragStart && !busy && !['accepted', 'awaiting_acceptance', 'cancelled'].includes(task.state)}
    onDragStart={event => { dragged.current = true; onDragStart?.(event, task); }}
    onDragEnd={() => { onDragEnd?.(); setTimeout(() => { dragged.current = false; }, 0); }}>
    <button type="button" className="execution-card__summary" aria-label={`展开任务 ${task.title}`} aria-expanded={expanded} aria-controls={`execution-task-${task.id}`} onClick={() => { if (!dragged.current) setExpanded(value => !value); }}>
      <strong title={task.title}>{task.title}</strong><ChevronDown size={14} aria-hidden="true" />
    </button>
    <div className="execution-card__primary execution-card__actions">
      <span className={`execution-status status-${task.state}`}>{labels[task.state]}</span>
      <button type="button" disabled={busy} onClick={() => onOpenTask(task.id)}><ListTodo size={12} />{task.state === 'defining' ? '完善要求' : task.state === 'awaiting_acceptance' ? '审阅交付' : '查看详情'}</button>
    </div>
    <div className="execution-card__badges"><AiBadge task={task} /></div>
    <div id={`execution-task-${task.id}`} className="execution-card__content" hidden={!expanded}>
      <div className="execution-card__body">
        <span className="execution-card__topline"><span>{priorityLabels[task.priority]}优先级</span><span>r{task.revision}</span></span>
        <small>{projects.find(project => project.id === task.projectId)?.title || '无项目'} · {task.plannedStart ? `${fmt(task.plannedStart)} → ${fmt(task.plannedEnd)}` : '未排期'}</small>
        {task.description && <small>{task.description}</small>}
      </div>
    </div>
  </article>;
}

export function BoardView({ tasks, projects, busy, onOpenTask, onTransition, onError }) {
  const [dropTarget, setDropTarget] = useState(null);
  const [showCompletedHistory, setShowCompletedHistory] = useState(false);
  const endDrag = () => setDropTarget(null);
  const renderTask = task => <ExecutionCard key={task.id} task={task} projects={projects} busy={busy} onOpenTask={onOpenTask}
    onDragStart={(event, value) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/ai-todos', JSON.stringify({ id: value.id, revision: value.revision })); }} onDragEnd={endDrag} />;
  return <div className="execution-board" aria-label="任务执行看板" tabIndex={0}>
    {boardColumns.map(column => {
      const items = tasks.filter(task => column.states.includes(task.state));
      const completed = column.id === 'completed';
      if (completed) items.sort((left, right) => (Date.parse(right.updatedAt) || 0) - (Date.parse(left.updatedAt) || 0));
      return <section className={`execution-column column-${column.id} ${dropTarget === column.id ? 'is-drop-target' : ''}`} key={column.id} aria-labelledby={`execution-column-${column.id}`}
        onDragOver={event => { if (!busy && event.dataTransfer.types.includes('application/ai-todos')) { event.preventDefault(); setDropTarget(column.id); } }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) endDrag(); }}
        onDrop={event => {
          event.preventDefault(); endDrag();
          if (busy || !event.dataTransfer.types.includes('application/ai-todos')) return;
          try {
            const value = JSON.parse(event.dataTransfer.getData('application/ai-todos'));
            const task = tasks.find(item => item.id === value.id);
            if (!task || column.states.includes(task.state)) return;
            if (['accepted', 'awaiting_acceptance'].includes(column.dropTarget)) throw new Error('请通过提交证据和人工审阅推进此状态。');
            onTransition(task.id, value.revision, column.dropTarget);
          } catch (error) { onError(error.message); }
        }}>
        <header><span><i aria-hidden="true" /><strong id={`execution-column-${column.id}`}>{column.label}</strong></span><em>{items.length}</em></header>
        <div className="execution-column__tasks" tabIndex={0} aria-label={`${column.label}卡片`}>
          {items.slice(0, completed && !showCompletedHistory ? 5 : undefined).map(renderTask)}
          {!items.length && <div className="execution-column__empty">暂无任务</div>}
        </div>
        {completed && items.length > 5 && <button type="button" className="execution-column__history" aria-expanded={showCompletedHistory} onClick={() => setShowCompletedHistory(value => !value)}>{showCompletedHistory ? '收起完成历史' : `查看完成历史（${items.length} 项）`}</button>}
      </section>;
    })}
  </div>;
}

function TimelineBar({ task, anchor, dayWidth, width, busy, onOpenTask, onReschedule }) {
  const [preview, setPreview] = useState(null);
  const pointer = useRef(null);
  const suppressClick = useRef(false);
  const start = (Date.parse(task.plannedStart) - anchor) / 86400000 * dayWidth;
  const end = (Date.parse(task.plannedEnd) - anchor) / 86400000 * dayWidth;
  const left = Math.max(0, start), originalWidth = Math.max(8, Math.min(width, end) - left);
  if (end <= 0 || start >= width) return null;
  const locked = ['accepted', 'awaiting_acceptance'].includes(task.state);
  const finishPointer = (event, cancelled = false) => {
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
    onPointerDown={event => { if (event.button !== 0 || locked) return; pointer.current = { id: event.pointerId, x: event.clientX, edge: event.target.dataset.edge }; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={event => {
      const active = pointer.current;
      if (!active || active.id !== event.pointerId) return;
      const delta = event.clientX - active.x;
      if (Math.abs(delta) >= 4) setPreview({ left: left + (active.edge === 'end' ? 0 : delta), width: Math.max(8, originalWidth + (active.edge === 'end' ? delta : active.edge === 'start' ? -delta : 0)) });
    }}
    onPointerUp={event => finishPointer(event)} onPointerCancel={event => finishPointer(event, true)}
    onClick={() => { if (!suppressClick.current) onOpenTask(task.id); }}
    onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); onReschedule(task, event.key === 'ArrowLeft' ? -1 : 1, event.shiftKey ? 'end' : undefined); } }}
    aria-label={`${task.title}：${fmt(task.plannedStart)} 至 ${fmt(task.plannedEnd)}`} title={`${fmt(task.plannedStart)} → ${fmt(task.plannedEnd)}`}>
    {!locked && <span className="resize-handle start" data-edge="start" />}{task.title}{!locked && <span className="resize-handle end" data-edge="end" />}
  </button>;
}

export function TimelineView({ tasks, projects, busy, onOpenTask, onReschedule }) {
  const [zoom, setZoom] = useState('day');
  const todayAnchor = () => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - 3); return date.getTime(); };
  const [anchor, setAnchor] = useState(todayAnchor);
  const scheduled = tasks.filter(task => task.plannedStart && task.state !== 'cancelled');
  const unscheduled = tasks.filter(task => !task.plannedStart && !['cancelled', 'accepted'].includes(task.state));
  const dayWidth = { day: 60, week: 26, month: 10 }[zoom], days = { day: 45, week: 90, month: 180 }[zoom], step = { day: 1, week: 7, month: 30 }[zoom], width = dayWidth * days;
  return <div className="execution-timeline">
    <div className="timeline-toolbar"><span><CalendarRange size={15} />计划窗口 <strong>{scheduled.length}</strong> 项</span>
      <div className="row"><button aria-label="向前两周" onClick={() => setAnchor(value => value - 14 * 86400000)}>←</button><button onClick={() => setAnchor(todayAnchor())}>今天</button><button aria-label="向后两周" onClick={() => setAnchor(value => value + 14 * 86400000)}>→</button>
        <div className="segmented-control timeline-zoom" aria-label="甘特图时间粒度">{[['day', '日'], ['week', '周'], ['month', '月']].map(([value, label]) => <button key={value} className={zoom === value ? 'is-active' : ''} aria-pressed={zoom === value} onClick={() => setZoom(value)}>{label}</button>)}</div>
      </div>
    </div>
    <div className="timeline-table"><div className="timeline-label-column"><div className="timeline-label-heading">任务 / 项目</div>{scheduled.map(task => <div className="timeline-task-label" key={task.id}><button className="quiet" onClick={() => onOpenTask(task.id)} title={task.title}>{task.title}</button><small>{projects.find(project => project.id === task.projectId)?.title || '无项目'} · {labels[task.state]}</small></div>)}</div>
      <div className="timeline-scroll" tabIndex={0} aria-label="甘特图时间轴，可水平滚动"><div className="timeline-canvas" style={{ width }}>
        <div className="timeline-axis" style={{ gridTemplateColumns: `repeat(${Math.ceil(days / step)}, ${step * dayWidth}px)` }}>{Array.from({ length: Math.ceil(days / step) }, (_, index) => <span key={index}><strong>{new Date(anchor + index * step * 86400000).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</strong></span>)}</div>
        {scheduled.map(task => <div className="timeline-row" key={task.id} style={{ '--timeline-cell': `${dayWidth}px` }}><TimelineBar task={task} anchor={anchor} dayWidth={dayWidth} width={width} busy={busy} onOpenTask={onOpenTask} onReschedule={onReschedule} /></div>)}
        {!scheduled.length && <p className="empty-state">暂无已排期任务，在任务详情中设置计划时间。</p>}
      </div></div>
    </div>
    <section className="execution-unscheduled"><header><span><ListTodo size={15} /><strong>未排期</strong></span><em>{unscheduled.length}</em></header><div>{unscheduled.map(task => <ExecutionCard key={task.id} task={task} projects={projects} busy={busy} onOpenTask={onOpenTask} />)}</div>{!unscheduled.length && <p>所有活动任务均已排期。</p>}</section>
    <p className="muted">拖动移动，边缘调整起止；键盘 ← → 移动一天，Shift 调整结束。保存使用实际读取的 revision。</p>
  </div>;
}
