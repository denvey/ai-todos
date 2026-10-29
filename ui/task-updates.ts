import type { Task } from '../src/types.ts';

// Keep newer task revisions when a background snapshot races a local save.
// AI observations belong to the snapshot, not the task mutation response.
export function mergeTaskUpdates(tasks: Task[], updates: Task[]): Task[] {
  const byId = new Map(updates.map(task => [task.id, task]));
  return tasks.map(task => {
    const update = byId.get(task.id);
    return update && update.revision > task.revision ? { ...task, ...update, ai: task.ai } : task;
  });
}
