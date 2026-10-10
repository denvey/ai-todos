// Adapted from Xinmo Desktop FocusCard.tsx; ai-todos tracks elapsed time, not pomodoro phases.
import { Pause, Play, Plus, Square } from 'lucide-react';
import { clock, hours } from '../format.js';

export function FocusCard({ focus, busy, task, elapsedMs, onStart, onPause, onResume, onEnd, onNeedTask }) {
  const idle = focus.status === 'idle';
  const Icon = idle ? (task ? Play : Plus) : focus.status === 'running' ? Pause : Play;
  const label = idle ? (task ? '开始专注' : '添加任务') : focus.status === 'running' ? '暂停专注' : '继续专注';
  const control = <button className="primary-icon focus-control" disabled={busy} onClick={idle ? (task ? onStart : onNeedTask) : focus.status === 'running' ? onPause : onResume} aria-label={label}><Icon size={18} /></button>;
  if (idle) return <section className="card focus-card is-idle" aria-labelledby="focus-heading"><div className="focus-idle-row">{control}<div className="focus-idle-copy"><strong id="focus-heading">{task?.title || '添加一项任务开始'}</strong><span>准备专注</span></div></div></section>;
  return <section className={`card focus-card status-${focus.status}`} aria-labelledby="focus-heading">
    <div className="focus-status"><span id="focus-heading">{focus.status === 'running' ? '专注中' : '专注已暂停'}</span><i aria-hidden="true" /></div>
    <div className="timer-line"><div className="focus-timer"><time>{clock(elapsedMs)}</time></div>{control}</div>
    <div className="focus-task"><strong>{task?.title || '原专注任务已移除'}</strong><span>本轮已专注 {hours(elapsedMs)}</span></div>
    <div className="focus-actions"><button className="focus-end-action" onClick={onEnd} disabled={busy}><Square size={13} /><span>结束并记录</span></button></div>
  </section>;
}
