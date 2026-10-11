import { i18n, getLocale } from '../src/i18n.ts';
import type { TranslationKey } from '../src/i18n.ts';
import type { Notice } from '../src/types.ts';
export const labels: Record<string, TranslationKey> = { defining: 'state.defining', ready: 'state.ready', executing: 'state.executing', awaiting_acceptance: 'state.awaitingAcceptance', changes_requested: 'state.changesRequested', accepted: 'state.accepted', cancelled: 'state.cancelled' };
export { runtimeLabels, runtimeLabel } from '../src/runtime.ts';
export const priorityLabels: Record<string, TranslationKey> = { low: 'priority.low', normal: 'priority.normal', high: 'priority.high' };
export const fmt = (value?: string | number | null) => value ? new Date(value).toLocaleString(getLocale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : i18n.t('schedule.unscheduled');
export const number = (value: number) => new Intl.NumberFormat(getLocale()).format(value);
export function hours(ms: number) {
  const key = ms < 60000 ? 'time.seconds' : ms < 3600000 ? 'time.minutes' : 'time.hours';
  const count = ms < 60000 ? Math.floor(ms / 1000) : Math.round(ms / (ms < 3600000 ? 60000 : 3600000) * 10) / 10;
  const value = new Intl.NumberFormat(getLocale(), { minimumFractionDigits: ms < 60000 ? 0 : 1, maximumFractionDigits: 1 }).format(count);
  return i18n.t(key, { count, value });
}
export function noticeTitle(notice: Notice) {
  if (notice.key.startsWith('review:')) return i18n.t('notices.dailyReview');
  const prefix = notice.key.startsWith('reminder:') ? '任务提醒：' : notice.key.startsWith('follow:') ? '进度跟进：' : null;
  if (!prefix || !notice.title.startsWith(prefix)) return notice.title;
  return i18n.t(prefix === '任务提醒：' ? 'notices.taskReminder' : 'notices.followUp', { title: notice.title.slice(prefix.length) });
}
export function localDay(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function dateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return `${localDay(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function clock(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
export const parseSchedule = (values: { plannedStart: string; plannedEnd: string }) => ({ plannedStart: values.plannedStart ? new Date(values.plannedStart).toISOString() : null, plannedEnd: values.plannedEnd ? new Date(values.plannedEnd).toISOString() : null });
