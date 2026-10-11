import { useTranslation } from 'react-i18next';
// Adapted from Xinmo Desktop GoalsView.tsx; entity edits use ai-todos callbacks.
import type { Snapshot, KeyResult, Kind, Entity } from '../../src/types.ts';
import type { TaskCallbacks } from '../types.ts';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { fmt, labels, number } from '../format.ts';

export function GoalsView({ snapshot, busy, onEdit, onNew, onOpenTask }: { snapshot: Snapshot; busy: boolean; onEdit: (kind: Kind, entity: Entity) => void; onNew: (kind: Kind, parent: string) => void; onOpenTask: TaskCallbacks['onOpenTask'] }) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null | undefined>(snapshot.objectives[0]?.id);
  const progressOf = (result: KeyResult) => Math.max(0, Math.min(100, (result.current - result.baseline) / (result.target - result.baseline) * 100));
  return <section className="goals-view"><div className="objective-list">{snapshot.objectives.map(objective => {
    const results = snapshot.keyResults.filter(result => result.objectiveId === objective.id);
    const progress = results.length ? Math.round(results.reduce((sum, result) => sum + progressOf(result), 0) / results.length) : 0;
    const expanded = expandedId === objective.id;
    return <section className="objective-block" key={objective.id}><div className="objective-row-shell"><button className="objective-row" onClick={() => setExpandedId(expanded ? null : objective.id)} aria-expanded={expanded}><div className="objective-progress" style={{ '--progress': `${progress}%` } as CSSProperties}><strong>{progress}%</strong></div><div><strong>{objective.title}</strong>{objective.description && <span>{objective.description}</span>}<small>{t("okr.keyResultCount", { count: results.length })}{objective.plannedStart ? ` · ${fmt(objective.plannedStart)} → ${fmt(objective.plannedEnd)}` : ''}</small></div></button><div className="objective-local-actions"><button disabled={busy} className="quiet small" onClick={() => onNew('keyResult', objective.id)}><Plus size={14} />{t("okr.addKeyResult")}</button><button className="quiet small" disabled={busy} onClick={() => onEdit('objective', objective)}>{t("okr.editObjective")}</button></div><button className="objective-toggle quiet icon-button" aria-label={t(expanded ? 'okr.collapseObjective' : 'okr.expandObjective', { title: objective.title })} aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : objective.id)}><ChevronDown size={17} aria-hidden="true" /></button></div>
      {expanded && <div className="objective-detail kr-tree">
        {results.map(result => <details className="kr-tree-item" key={result.id} open><summary><div><strong>{result.title}</strong><span>{number(result.baseline)} → {number(result.current)} / {number(result.target)} {result.unit}</span></div><div className="kr-actions"><span>{Math.round(progressOf(result))}%</span><ChevronDown size={16} /></div></summary><div className="progress-track"><span style={{ width: `${progressOf(result)}%` }} /></div><div className="kr-tree-actions"><button disabled={busy} className="quiet small" onClick={() => onEdit('keyResult', result)}>{t("okr.updateKeyResult")}</button></div><div className="independent-actions">{snapshot.tasks.filter(task => task.keyResultId === result.id).map(task => <div className="row spaced" key={task.id}><button className="quiet small" onClick={() => onOpenTask(task.id)}>{task.title}</button><span className="execution-status">{t(labels[task.state])}</span></div>)}</div></details>)}
        {!results.length && <div className="empty-state compact">{t("okr.noKeyResults")}</div>}
      </div>}
    </section>;
  })}</div>{!snapshot.objectives.length && <div className="empty-state"><strong>{t("okr.emptyTitle")}</strong><span>{t("okr.emptyHint")}</span></div>}</section>;
}
