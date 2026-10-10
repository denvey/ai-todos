export const labels = { defining: '定义中', ready: '已就绪', executing: '执行中', awaiting_acceptance: '待验收', changes_requested: '待修改', accepted: '已验收', cancelled: '已取消' };
export const runtimeLabels = { running: 'AI 运行中', waiting: 'AI 等待许可', idle: 'AI 本轮结束', interrupted: 'AI 已中断', ended: 'AI 会话结束', unknown: 'AI 状态未知' };
export const priorityLabels = { low: '低', normal: '普通', high: '高' };
export const fmt = value => value ? new Date(value).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未排期';
export const hours = ms => ms < 60000 ? `${Math.floor(ms / 1000)} 秒` : ms < 3600000 ? `${(ms / 60000).toFixed(1)} 分钟` : `${(ms / 3600000).toFixed(1)} 小时`;
export function localDay(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function dateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${localDay(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function clock(ms) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
export const parseSchedule = values => ({ plannedStart: values.plannedStart ? new Date(values.plannedStart).toISOString() : null, plannedEnd: values.plannedEnd ? new Date(values.plannedEnd).toISOString() : null });
