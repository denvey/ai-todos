import type { Task } from '../src/types.ts';
import { i18n, getLocale } from '../src/i18n.ts';
import type { Locale } from '../src/i18n.ts';

export function executionPrompt(task: Pick<Task, 'id' | 'title' | 'sessionId'>) {
  const binding = task.sessionId ? i18n.t('prompt.bound', { sessionId: task.sessionId }) : i18n.t('prompt.unbound');
  return i18n.t('prompt.execution', { id: task.id, title: task.title, binding });
}

export function taskSessionPrompt(task: Pick<Task, 'title' | 'description' | 'criteria'>, lng: Locale = getLocale()) {
  return [task.title, task.description.trim() && i18n.t('prompt.description', { description: task.description.trim(), lng }), task.criteria.trim() && i18n.t('prompt.criteria', { criteria: task.criteria.trim(), lng })].filter(Boolean).join('\n\n');
}
