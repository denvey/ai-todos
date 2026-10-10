// Adapted from Xinmo InboxDrawer.tsx; previews stay local until promotion.
import type { FormEvent } from 'react';
import type { CaptureSuggestion, InboxItem } from '../../src/types.ts';
import type { InboxProps } from '../types.ts';
import { useEffect, useRef, useState } from 'react';
import { Archive, ArrowUpRight, CalendarPlus, ChevronDown, Inbox, Plus, RotateCcw, Search, Sparkles, X } from 'lucide-react';
import { fmt } from '../format.ts';

export function InboxView({ items, visible, busy, onClose, onCapture, onRefine, onPromote, onArchive }: InboxProps) {
  const [improvements, setImprovements] = useState<Record<string, CaptureSuggestion>>({});
  const [improvingId, setImprovingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [captureText, setCaptureText] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const captureRef = useRef<HTMLInputElement>(null), requests = useRef(new Map<string, string>());
  const active = items.filter(item => !item.archived), archived = items.filter(item => item.archived);
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  const visibleItems = active.filter(item => (filter === 'all' || Boolean(improvements[item.id]) === (filter === 'organized')) && `${item.title} ${improvements[item.id]?.title || ''}`.toLocaleLowerCase('zh-CN').includes(normalizedQuery));
  useEffect(() => { if (visible) captureRef.current?.focus(); }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented && !busy && !document.querySelector('[role="dialog"]')) onClose(); };
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
  }, [visible, busy, onClose]);
  const requestId = (payload: unknown) => { const key = JSON.stringify(payload); if (!requests.current.has(key)) requests.current.set(key, crypto.randomUUID()); return requests.current.get(key)!; };
  const capture = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !captureText.trim()) return;
    if (await onCapture(captureText.trim(), requestId({ capture: captureText.trim() }))) { setCaptureText(''); requests.current.clear(); captureRef.current?.focus(); }
  };
  const improve = async (item: InboxItem) => {
    if (busy) return; setImprovingId(item.id);
    try { await onRefine({ title: item.title }, result => setImprovements(current => ({ ...current, [item.id]: result }))); }
    finally { setImprovingId(null); }
  };
  const promote = (item: InboxItem, today: boolean, openAfter: boolean) => {
    const draft = improvements[item.id], data = { title: draft?.title || item.title, description: draft?.description || '', criteria: draft?.criteria || '' };
    return onPromote(item, data, today, openAfter, requestId({ id: item.id, revision: item.revision, data, today }));
  };
  return <section className="inbox-page" aria-labelledby="inbox-title" hidden={!visible}>
    <header className="inbox-page__header"><div className="inbox-page__title"><span className="section-kicker">先捕获，后整理</span><h2 id="inbox-title">收件箱</h2><p>{active.length ? `${active.length} 条想法等你决定，不计入待办和逾期。` : '想到什么就先放进来，不需要马上想清楚。'}</p></div></header>
    <div className="inbox-page__body"><form className="quick-add inbox-capture" onSubmit={capture}><Plus size={16} /><input ref={captureRef} value={captureText} disabled={busy} maxLength={300} onChange={event => { setCaptureText(event.target.value); requests.current.clear(); }} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }} placeholder="想到什么先记下来，回车保存" aria-label="记录收件箱想法" /><button type="submit" disabled={busy || !captureText.trim()}>记下</button></form>
      {!active.length && <div className="empty-state inbox-empty"><Inbox size={24} /><strong>收件箱已经清空</strong><span>有新想法时，在上方输入并回车记下。</span></div>}
      {!!active.length && <div className="inbox-tools"><label className="inbox-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索想法" aria-label="搜索收件箱" />{query && <button type="button" onClick={() => setQuery('')} aria-label="清除搜索"><X size={13} /></button>}</label><div className="inbox-filters" role="group" aria-label="筛选收件箱">{([['all', '全部', active.length], ['unorganized', '待整理', active.filter(item => !improvements[item.id]).length], ['organized', '已整理', active.filter(item => improvements[item.id]).length]] as const).map(([value, label, count]) => <button key={value} type="button" className={filter === value ? 'is-active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} {count}</button>)}</div></div>}
      {!!active.length && !visibleItems.length && <div className="empty-state inbox-filter-empty"><strong>没有符合条件的想法</strong><span>换一个筛选条件，或清除搜索内容。</span></div>}
      <div className="inbox-list">{visibleItems.map(item => {
        const draft = improvements[item.id], expanded = expandedId === item.id;
        return <article className={`inbox-item ${draft ? 'has-draft' : ''} ${expanded ? 'is-expanded' : ''}`} key={item.id}>
          <button type="button" className="inbox-item__summary" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : item.id)}><span><span className="inbox-item__time">{fmt(item.createdAt)} · {draft ? '已整理' : '待整理'}</span><strong>{item.title}</strong></span><ChevronDown size={15} /></button>
          {expanded && draft && <div className="inbox-ai-draft" aria-live="polite"><span className="inbox-ai-draft__label"><Sparkles size={13} />AI 整理稿</span><strong>{draft.title}</strong><p>{draft.description}</p><p>{draft.criteria}</p><small>原始想法会保留，确认后只改变任务展示内容。</small></div>}
          {expanded && <div className="inbox-item__actions"><button type="button" onClick={() => improve(item)} disabled={busy}><Sparkles size={14} />{improvingId === item.id ? '整理中' : draft ? '重新整理' : 'AI 整理'}</button><button type="button" onClick={() => promote(item, false, false)} disabled={busy}>转为任务</button><button type="button" className="is-primary" onClick={() => promote(item, true, false)} disabled={busy}><CalendarPlus size={14} />加入今天</button><button type="button" className="inbox-item__link" onClick={() => promote(item, false, true)} disabled={busy}>完善任务定义<ArrowUpRight size={13} /></button><button type="button" className="inbox-item__archive" onClick={() => onArchive(item, true)} disabled={busy} aria-label={`归档 ${item.title}`} title="归档"><Archive size={14} />归档</button></div>}
        </article>;
      })}</div>
      {!!archived.length && filter === 'all' && !normalizedQuery && <section className="inbox-archive"><button type="button" className="inbox-archive__toggle" onClick={() => setShowArchived(value => !value)}>{showArchived ? '收起已归档' : `查看已归档 ${archived.length}`}</button>{showArchived && archived.map(item => <div className="inbox-archived-item" key={item.id}><span><strong>{item.title}</strong><small>{fmt(item.createdAt)}</small></span><button type="button" onClick={() => onArchive(item, false)} disabled={busy}><RotateCcw size={13} />恢复</button></div>)}</section>}
    </div>
  </section>;
}
