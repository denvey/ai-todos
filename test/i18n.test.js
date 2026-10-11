import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstance } from 'i18next';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { i18n, resources, languages, resolveLocale } from '../src/i18n.ts';
import { DomainError, errorPayload, settingsSchema } from '../src/domain.ts';
import { codexActionSchema } from '../src/codex.ts';
import { runtimeLabel } from '../src/runtime.ts';
import { boardColumns, taskStatus, boardDropDecision } from '../ui/execution-board.ts';
import { fmt, hours, noticeTitle, number } from '../ui/format.ts';
import { executionPrompt, taskSessionPrompt } from '../ui/codex-prompts.ts';

const placeholders = value => [...value.matchAll(/\{\{([^},]+)(?:,[^}]+)?\}\}/g)].map(match => match[1]).sort();

test('all languages have every base key, matching interpolation variables and locale-specific plural forms', () => {
  const baseKeys = Object.keys(resources.en.translation).filter(key => !/_(one|other)$/.test(key));
  for (const [locale, { translation }] of Object.entries(languages)) {
    for (const key of baseKeys) {
      assert.ok(translation[key]?.trim(), `${locale}: ${key}`);
      assert.deepEqual(placeholders(translation[key]), placeholders(resources.en.translation[key]), `${locale}: ${key}`);
    }
    for (const [key, value] of Object.entries(translation)) {
      assert.ok(!/(?<!\{)\{\w+\}(?!\})/.test(value), `${locale}: legacy interpolation in ${key}`);
      if (/_(one|other)$/.test(key)) assert.ok(translation[key.replace(/_(one|other)$/, '')], `${locale}: orphan plural ${key}`);
    }
  }
  assert.equal(resolveLocale('ZH-cn'), 'zh-CN');
  assert.equal(resolveLocale('zh-Hans'), 'zh-CN');
  assert.equal(resolveLocale('en-US'), 'en');
  assert.equal(resolveLocale('de-DE'), 'en');
  assert.equal(resolveLocale(), 'en');
});

test('English pluralization, interpolation and missing translations use the bundled fallback', async () => {
  await i18n.changeLanguage('en');
  assert.equal(i18n.t('board.taskCount', { count: 1, sessions: '' }), '1 task');
  assert.equal(i18n.t('board.taskCount', { count: 2, sessions: '' }), '2 tasks');
  assert.equal(i18n.t('okr.keyResultCount', { count: 1 }), '1 key result');
  assert.equal(i18n.t('okr.keyResultCount', { count: 2 }), '2 key results');
  assert.equal(i18n.t('settings.followUpMinutes', { count: 1, followUpMinutes: 1 }), 'Every 1 minute');
  assert.equal(i18n.t('settings.followUpMinutes', { count: 2, followUpMinutes: 2 }), 'Every 2 minutes');
  assert.equal(i18n.t('board.summary', { taskCount: i18n.t('board.taskCount', { count: 1 }), sessionCount: i18n.t('board.sessionCount', { count: 1 }) }), '1 task · 1 chat on the board');
  assert.equal(hours(1000), '1 second');
  assert.equal(hours(2000), '2 seconds');
  assert.equal(hours(60000), '1.0 minute');
  assert.equal(hours(120000), '2.0 minutes');
  assert.equal(hours(3600000), '1.0 hour');
  assert.equal(number(1234.5), '1,234.5');
  assert.equal(fmt(null), 'Unscheduled');
  assert.equal(fmt('2026-10-11T01:02:00Z'), new Date('2026-10-11T01:02:00Z').toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
  assert.equal(taskStatus({ state: 'awaiting_acceptance' }), 'Awaiting my acceptance');
  assert.equal(taskStatus({ state: 'accepted' }), 'Completed');
  assert.equal(taskStatus({ state: 'cancelled' }), 'Cancelled');
  assert.equal(runtimeLabel({ state: 'running', mode: 'planning' }), 'Planning');
  assert.ok(boardColumns.every(column => i18n.t(column.label) !== column.label));
  assert.match(boardDropDecision({ state: 'executing' }, 'completed').reason, /human review/);
  const fallback = createInstance();
  await fallback.init({ resources: { en: resources.en, 'zh-CN': { translation: {} } }, lng: 'zh-CN', fallbackLng: 'en', keySeparator: false });
  assert.equal(fallback.t('task.create'), 'Create task');
  await i18n.changeLanguage('zh-CN');
  assert.equal(hours(60000), '1.0 分钟');
  assert.equal(taskStatus({ state: 'awaiting_acceptance' }), '待我验收');
});

test('reminders and execution instructions translate without changing user content or task identity', async () => {
  const title = '原文 {{count}} $t(task.create)';
  await i18n.changeLanguage('en');
  assert.equal(noticeTitle({ key: 'reminder:task:date', title: `任务提醒：${title}` }), `Task reminder: ${title}`);
  assert.equal(noticeTitle({ key: 'follow:task:date:1', title: `进度跟进：${title}` }), `Progress follow-up: ${title}`);
  assert.equal(noticeTitle({ key: 'review:date', title: '每日复盘：回顾交付、专注时间与明日计划' }), resources.en.translation['notices.dailyReview']);
  assert.equal(noticeTitle({ key: 'custom:date', title }), title);
  assert.equal(noticeTitle({ key: 'reminder:date', title }), title);
  const id = randomUUID(), sessionId = randomUUID();
  const prompt = executionPrompt({ id, sessionId, title });
  assert.ok(prompt.includes(id) && prompt.includes(sessionId) && prompt.includes(title));
  assert.match(prompt, /Never guess IDs|Verify it/);
  assert.match(prompt, /AI must not accept its own delivery/);
  assert.match(executionPrompt({ id, title }), /Never guess IDs or create duplicate tasks/);
  assert.equal(taskSessionPrompt({ title, description: '描述原文', criteria: '验收原文' }), `${title}\n\nTask description:\n描述原文\n\nAcceptance criteria:\n验收原文`);
  assert.equal(taskSessionPrompt({ title, description: '', criteria: '' }), title);
  assert.equal(codexActionSchema.parse({ operation: 'open_session', id, locale: 'en' }).locale, 'en');
  assert.ok(!codexActionSchema.safeParse({ operation: 'open_session', id, locale: 'invalid' }).success);
  await i18n.changeLanguage('zh-CN');
});

test('HTTP and MCP error payloads retain codes, parameters and localized validation details', async () => {
  const { localizedError } = await import('../ui/i18n.ts');
  const error = new DomainError('errors.transition', 400, { from: 'defining', to: 'executing' });
  assert.equal(error.message, '不能从 defining 变为 executing');
  const payload = errorPayload(error);
  assert.equal(payload.code, 'errors.transition');
  assert.deepEqual(errorPayload(Object.assign(new Error(payload.error), payload)), payload);
  await i18n.changeLanguage('en');
  assert.equal(localizedError(payload), 'Cannot transition from defining to executing.');
  const parsed = settingsSchema.safeParse({ reminders: true, followUpMinutes: 0, reviewTime: null, timezone: 'Invalid/TimeZone' });
  const validation = errorPayload(parsed.error);
  assert.match(localizedError(validation), /Invalid time zone/);
  assert.match(localizedError(validation), /timezone/);
  const standard = errorPayload(z.object({ count: z.number().min(1) }).safeParse({ count: 0 }).error);
  assert.match(localizedError(standard), /Too small/);
  assert.equal(localizedError({ code: 'unexpected.external.code', error: 'External failure' }), 'External failure');
  await i18n.changeLanguage('zh-CN');
  assert.match(localizedError(validation), /时区无效/);
  assert.match(localizedError(standard), /数值过小/);
  assert.equal(localizedError(errorPayload(new DomainError('errors.unauthorized'))), '未授权');
  assert.equal(localizedError(errorPayload(new DomainError('errors.routeMissing'))), '未找到资源');
});

test('language preference follows host then browser, survives reload, updates document and tolerates blocked storage', async t => {
  const descriptors = Object.fromEntries(['window', 'document', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => { for (const [key, descriptor] of Object.entries(descriptors)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  const storage = new Map();
  const browser = Object.assign(new EventTarget(), { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { lang: '' }, title: '' } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'zh-CN' } });
  const pref = await import('../ui/i18n.ts?preference-test');
  assert.equal(pref.getLanguagePreference(), 'auto');
  assert.equal(document.documentElement.lang, 'zh-CN');
  pref.applyHostLocale('en-US');
  assert.equal(document.title, 'Todos · Workspace');
  assert.equal(pref.setLanguagePreference('zh-CN'), true);
  assert.equal(storage.get('ai-todos.language'), 'zh-CN');
  pref.applyHostLocale('en-US');
  assert.equal(document.documentElement.lang, 'zh-CN');
  const reloaded = await import('../ui/i18n.ts?preference-reload-test');
  assert.equal(reloaded.getLanguagePreference(), 'zh-CN');
  reloaded.applyHostLocale('en');
  reloaded.setLanguagePreference('auto');
  assert.equal(document.documentElement.lang, 'en');
  reloaded.applyHostLocale(undefined);
  assert.equal(document.documentElement.lang, 'zh-CN');
  navigator.language = 'de-DE';
  browser.dispatchEvent(new Event('languagechange'));
  assert.equal(document.documentElement.lang, 'en');
  browser.dispatchEvent(Object.assign(new Event('storage'), { key: 'ai-todos.language', newValue: 'zh-CN' }));
  assert.equal(reloaded.getLanguagePreference(), 'zh-CN');
  assert.equal(document.documentElement.lang, 'zh-CN');
  browser.localStorage.setItem = () => { throw new Error('Blocked'); };
  assert.equal(reloaded.setLanguagePreference('en'), false);
  assert.equal(document.documentElement.lang, 'en');
});
