import { useTranslation } from 'react-i18next';
// Adapted from Xinmo Desktop FocusCard.tsx; ai-todos tracks elapsed time, not pomodoro phases.
import type { Focus, Task } from '../../src/types.ts';
import { Pause, Play, Plus, Square } from 'lucide-react';
import { clock, hours } from '../format.ts';

export function FocusCard({ focus, busy, task, elapsedMs, onStart, onPause, onResume, onEnd, onNeedTask }: { focus: Focus; busy: boolean; task?: Task; elapsedMs: number; onStart: () => void; onPause: () => void; onResume: () => void; onEnd: () => void; onNeedTask: () => void }) {
  const { t } = useTranslation();
  const idle = focus.status === 'idle';
  const Icon = idle ? (task ? Play : Plus) : focus.status === 'running' ? Pause : Play;
  const label = idle ? (task ? t("focus.start") : t("task.add")) : focus.status === 'running' ? t("focus.pause") : t("focus.resume");
  const control = <button className="primary-icon focus-control" disabled={busy} onClick={idle ? (task ? onStart : onNeedTask) : focus.status === 'running' ? onPause : onResume} aria-label={label}><Icon size={18} /></button>;
  if (idle) return <section className="card focus-card is-idle" aria-labelledby="focus-heading"><div className="focus-idle-row">{control}<div className="focus-idle-copy"><strong id="focus-heading">{task?.title || t("focus.addTask")}</strong><span>{t("focus.prepare")}</span></div></div></section>;
  return <section className={`card focus-card status-${focus.status}`} aria-labelledby="focus-heading">
    <div className="focus-status"><span id="focus-heading">{focus.status === 'running' ? t("focus.running") : t("focus.paused")}</span><i aria-hidden="true" /></div>
    <div className="timer-line"><div className="focus-timer"><time>{clock(elapsedMs)}</time></div>{control}</div>
    <div className="focus-task"><strong>{task?.title || t("focus.missingTask")}</strong><span>{t("focus.duration", { duration: hours(elapsedMs) })}</span></div>
    <div className="focus-actions"><button className="focus-end-action" onClick={onEnd} disabled={busy}><Square size={13} /><span>{t("focus.end")}</span></button></div>
  </section>;
}
