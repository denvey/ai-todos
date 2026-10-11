import { useTranslation } from 'react-i18next';
import { getLocale } from '../i18n.ts';
// Adapted from Xinmo InboxDrawer.tsx; previews stay local until promotion.
import type { FormEvent } from 'react';
import type { CaptureSuggestion, InboxItem } from '../../src/types.ts';
import type { InboxProps } from '../types.ts';
import { useEffect, useRef, useState } from 'react';
import { Archive, ArrowUpRight, CalendarPlus, ChevronDown, Inbox, Plus, RotateCcw, Search, Sparkles, X } from 'lucide-react';
import { fmt } from '../format.ts';

export function InboxView({ items, visible, busy, onClose, onCapture, onRefine, onPromote, onArchive }: InboxProps) {
  const { t } = useTranslation();
  const [improvements, setImprovements] = useState<Record<string, CaptureSuggestion>>({});
  const [improvingId, setImprovingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [captureText, setCaptureText] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const captureRef = useRef<HTMLInputElement>(null), requests = useRef(new Map<string, string>());
  const active = items.filter(item => !item.archived), archived = items.filter(item => item.archived);
  const normalizedQuery = query.trim().toLocaleLowerCase(getLocale());
  const visibleItems = active.filter(item => (filter === 'all' || Boolean(improvements[item.id]) === (filter === 'organized')) && `${item.title} ${improvements[item.id]?.title || ''}`.toLocaleLowerCase(getLocale()).includes(normalizedQuery));
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
    <header className="inbox-page__header"><div className="inbox-page__title"><span className="section-kicker">{t("inbox.kicker")}</span><h2 id="inbox-title">{t("nav.inbox")}</h2><p>{active.length ? t("inbox.pendingCount", { count: active.length }) : t("inbox.intro")}</p></div></header>
    <div className="inbox-page__body"><form className="quick-add inbox-capture" onSubmit={capture}><Plus size={16} /><input ref={captureRef} value={captureText} disabled={busy} maxLength={300} onChange={event => { setCaptureText(event.target.value); requests.current.clear(); }} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }} placeholder={t("inbox.placeholder")} aria-label={t("inbox.captureLabel")} /><button type="submit" disabled={busy || !captureText.trim()}>{t("inbox.save")}</button></form>
      {!active.length && <div className="empty-state inbox-empty"><Inbox size={24} /><strong>{t("inbox.emptyTitle")}</strong><span>{t("inbox.emptyHint")}</span></div>}
      {!!active.length && <div className="inbox-tools"><label className="inbox-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("inbox.search")} aria-label={t("inbox.searchLabel")} />{query && <button type="button" onClick={() => setQuery('')} aria-label={t("inbox.clearSearch")}><X size={13} /></button>}</label><div className="inbox-filters" role="group" aria-label={t("inbox.filterLabel")}>{([['all', t("common.all"), active.length], ['unorganized', t("inbox.unorganized"), active.filter(item => !improvements[item.id]).length], ['organized', t("inbox.organized"), active.filter(item => improvements[item.id]).length]] as const).map(([value, label, count]) => <button key={value} type="button" className={filter === value ? 'is-active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} {count}</button>)}</div></div>}
      {!!active.length && !visibleItems.length && <div className="empty-state inbox-filter-empty"><strong>{t("inbox.noMatches")}</strong><span>{t("inbox.filterHint")}</span></div>}
      <div className="inbox-list">{visibleItems.map(item => {
        const draft = improvements[item.id], expanded = expandedId === item.id;
        return <article className={`inbox-item ${draft ? 'has-draft' : ''} ${expanded ? 'is-expanded' : ''}`} key={item.id}>
          <button type="button" className="inbox-item__summary" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : item.id)}><span><span className="inbox-item__time">{fmt(item.createdAt)} · {draft ? t("inbox.organized") : t("inbox.unorganized")}</span><strong>{item.title}</strong></span><ChevronDown size={15} /></button>
          {expanded && draft && <div className="inbox-ai-draft" aria-live="polite"><span className="inbox-ai-draft__label"><Sparkles size={13} />{t("inbox.aiDraft")}</span><strong>{draft.title}</strong><p>{draft.description}</p><p>{draft.criteria}</p><small>{t("inbox.preserveOriginal")}</small></div>}
          {expanded && <div className="inbox-item__actions"><button type="button" onClick={() => improve(item)} disabled={busy}><Sparkles size={14} />{improvingId === item.id ? t("inbox.organizing") : draft ? t("inbox.reorganize") : t("inbox.aiOrganize")}</button><button type="button" onClick={() => promote(item, false, false)} disabled={busy}>{t("inbox.promote")}</button><button type="button" className="is-primary" onClick={() => promote(item, true, false)} disabled={busy}><CalendarPlus size={14} />{t("inbox.addToday")}</button><button type="button" className="inbox-item__link" onClick={() => promote(item, false, true)} disabled={busy}>{t("inbox.define")}<ArrowUpRight size={13} /></button><button type="button" className="inbox-item__archive" onClick={() => onArchive(item, true)} disabled={busy} aria-label={t("inbox.archiveNamed", { title: item.title })} title={t("inbox.archive")}><Archive size={14} />{t("inbox.archive")}</button></div>}
        </article>;
      })}</div>
      {!!archived.length && filter === 'all' && !normalizedQuery && <section className="inbox-archive"><button type="button" className="inbox-archive__toggle" onClick={() => setShowArchived(value => !value)}>{showArchived ? t("inbox.collapseArchived") : t("inbox.archivedCount", { count: archived.length })}</button>{showArchived && archived.map(item => <div className="inbox-archived-item" key={item.id}><span><strong>{item.title}</strong><small>{fmt(item.createdAt)}</small></span><button type="button" onClick={() => onArchive(item, false)} disabled={busy}><RotateCcw size={13} />{t("common.restore")}</button></div>)}</section>}
    </div>
  </section>;
}
