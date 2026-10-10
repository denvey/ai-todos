// Ported from Xinmo Desktop lib/execution-board.ts; normalize existing local observations.
export function runtimeState(state) { return ({ waiting: 'waiting_approval', ended: 'completed' })[state] || state || 'unknown'; }

export const runtimeLabels = {
  queued: '等待执行', running: '正在执行', waiting_approval: '等待审批', waiting_input: '等待输入',
  interrupted: '已中断', failed: '执行失败', completed: '待确定', idle: '待确定', unknown: '状态未确认',
};
const planningLabels = {
  queued: '等待规划', running: '正在规划', waiting_approval: '规划等待审批', waiting_input: '规划等待输入',
  interrupted: '规划已中断', failed: '规划失败', completed: '待确定', idle: '待确定', unknown: '状态未确认',
};
export function runtimeLabel(runtime) {
  if (!runtime) return undefined;
  return (runtime.mode === 'planning' ? planningLabels : runtimeLabels)[runtimeState(runtime.state)];
}
export function codexRuntimeState(status) {
  if (status.type === 'active') {
    if (status.activeFlags?.includes('waitingOnApproval')) return 'waiting_approval';
    if (status.activeFlags?.includes('waitingOnUserInput')) return 'waiting_input';
    return 'running';
  }
  return status.type === 'idle' ? 'idle' : status.type === 'systemError' ? 'failed' : 'unknown';
}
