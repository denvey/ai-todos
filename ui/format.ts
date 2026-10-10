export const labels: Record<string, string> = { defining: '需补充要求', ready: '可以开始', executing: 'AI 执行中', awaiting_acceptance: '待我验收', changes_requested: '需修改', accepted: '验收通过', cancelled: '已取消' };
export { runtimeLabels, runtimeLabel } from '../src/runtime.ts';
export const priorityLabels: Record<string, string> = { low: '低', normal: '普通', high: '高' };
export const fmt = (value?: string | number | null) => value ? new Date(value).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未排期';
export const hours = (ms: number) => ms < 60000 ? `${Math.floor(ms / 1000)} 秒` : ms < 3600000 ? `${(ms / 60000).toFixed(1)} 分钟` : `${(ms / 3600000).toFixed(1)} 小时`;
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
