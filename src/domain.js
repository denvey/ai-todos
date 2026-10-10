import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const text = z.string().trim().min(1).max(300);
const note = z.string().max(20000);
const id = z.string().uuid();
const date = z.iso.datetime({ offset: true });
const optionalId = id.nullable().default(null);
const scheduling = { plannedStart: date.nullable().default(null), plannedEnd: date.nullable().default(null) };
export const schemas = {
  task: z.object({ title: text, description: note.default(''), criteria: note.default(''), priority: z.enum(['low', 'normal', 'high']).default('normal'), projectId: optionalId, keyResultId: optionalId, ...scheduling, remindAt: date.nullable().default(null) }).strict(),
  project: z.object({ title: text, description: note.default('') }).strict(),
  objective: z.object({ title: text, description: note.default(''), ...scheduling }).strict(),
  keyResult: z.object({ title: text, objectiveId: id, baseline: z.number().finite().default(0), target: z.number().finite(), current: z.number().finite().default(0), unit: z.string().max(40).default('') }).strict(),
  plan: z.object({ title: text, date: z.iso.date(), note: note.default(''), taskIds: z.array(id).max(500).default([]) }).strict(),
  inbox: z.object({ title: text, archived: z.boolean().default(false) }).strict(),
};
const kinds = z.enum(Object.keys(schemas));
const revision = z.number().int().positive();
export const settingsSchema = z.object({ reminders: z.boolean(), followUpMinutes: z.number().int().min(0).max(10080), reviewTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(), timezone: z.string().refine(v => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true; } catch { return false; } }, 'Invalid timezone') }).strict();
export const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), kind: kinds, data: z.record(z.string(), z.unknown()), requestId: id, planDate: z.iso.date().optional() }).strict(),
  z.object({ action: z.literal('create_tasks'), data: z.array(schemas.task).min(1).max(20), requestId: id, planDate: z.iso.date() }).strict(),
  z.object({ action: z.literal('promote'), id, revision, data: schemas.task, requestId: id, planDate: z.iso.date().optional() }).strict(),
  z.object({ action: z.literal('daily_plan'), date: z.iso.date(), plans: z.array(z.object({ id, revision }).strict()).max(500), taskIds: z.array(id).max(500), note }).strict(),
  z.object({ action: z.literal('update'), kind: kinds, id, revision, data: z.record(z.string(), z.unknown()) }).strict(),
  z.object({ action: z.literal('delete'), kind: kinds, id, revision }).strict(),
  z.object({ action: z.literal('transition'), id, revision, state: z.enum(['defining', 'ready', 'executing', 'cancelled']) }).strict(),
  z.object({ action: z.literal('bind'), id, revision, sessionId: id.nullable() }).strict(),
  z.object({ action: z.literal('submit'), id, revision, summary: text, evidence: z.array(z.object({ label: text, uri: z.string().min(1).max(2000), note: note.default('') }).strict()).min(1).max(30) }).strict(),
  z.object({ action: z.literal('focus'), operation: z.enum(['start', 'pause', 'resume', 'finish']), taskId: id.optional(), revision: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal('settings'), revision: z.number().int().nonnegative(), data: settingsSchema }).strict(),
  z.object({ action: z.literal('ack'), id }).strict(),
]);
const reviewSchema = z.object({ id, revision, decision: z.enum(['accept', 'reject']), confirmed: z.literal(true), reviewer: text, note: note.default('') }).strict();
export class DomainError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function requireThat(condition, message, status = 400) { if (!condition) throw new DomainError(message, status); }
export function elapsed(focus, now = Date.now()) {
  return focus.elapsedMs + (focus.startedAt ? Math.max(0, now - Date.parse(focus.startedAt)) : 0);
}

export class Store {
  constructor(path, now = () => Date.now()) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path); this.now = now;
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS entities (kind TEXT NOT NULL, id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, task_id TEXT, at TEXT NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS notices (id TEXT PRIMARY KEY, body TEXT NOT NULL);`);
  }
  close() { this.db.close(); }
  at() { return new Date(this.now()).toISOString(); }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  all(kind) { return this.db.prepare('SELECT body FROM entities WHERE kind=? ORDER BY rowid').all(kind).map(r => JSON.parse(r.body)); }
  get(kind, entityId) {
    const row = this.db.prepare('SELECT body FROM entities WHERE kind=? AND id=?').get(kind, entityId);
    requireThat(row, `${kind} 不存在`, 404); return JSON.parse(row.body);
  }
  check(item, expected) { requireThat(item.revision === expected, '数据已更新。请重新打开并审阅后重试。', 409); }
  save(kind, item) { this.db.prepare('INSERT OR REPLACE INTO entities VALUES (?,?,?)').run(kind, item.id, JSON.stringify(item)); return item; }
  meta(key, fallback) { const row = this.db.prepare('SELECT body FROM meta WHERE key=?').get(key); return row ? JSON.parse(row.body) : fallback; }
  setMeta(key, value) { this.db.prepare('INSERT OR REPLACE INTO meta VALUES (?,?)').run(key, JSON.stringify(value)); return value; }
  event(taskId, type, details = {}) {
    const event = { id: randomUUID(), at: this.at(), type, ...details };
    this.db.prepare('INSERT INTO events VALUES (?,?,?,?)').run(event.id, taskId, event.at, JSON.stringify(event)); return event;
  }
  taskHistory(taskId) { return this.db.prepare('SELECT body FROM events WHERE task_id=? ORDER BY rowid DESC').all(taskId).map(r => JSON.parse(r.body)); }
  focus() { return this.meta('focus', { revision: 0, taskId: null, status: 'idle', elapsedMs: 0, startedAt: null, segments: [] }); }
  settings() { return this.meta('settings', { revision: 0, reminders: true, followUpMinutes: 60, reviewTime: '18:00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }); }
  sessions() {
    return this.db.prepare('SELECT body FROM sessions ORDER BY rowid DESC').all().map(r => {
      const s = JSON.parse(r.body);
      return { ...s, state: ['running', 'waiting'].includes(s.observedState) && this.now() - Date.parse(s.observedAt) > 300000 ? 'unknown' : s.observedState };
    });
  }
  snapshot() {
    const sessions = this.sessions();
    return {
      tasks: this.all('task').map(t => ({ ...t, ai: sessions.find(s => s.id === t.sessionId) ?? null })),
      projects: this.all('project'), objectives: this.all('objective'), keyResults: this.all('keyResult'), plans: this.all('plan'), inbox: this.all('inbox'), sessions,
      focus: { ...this.focus(), totalMs: elapsed(this.focus(), this.now()) }, settings: this.settings(),
      notices: this.db.prepare('SELECT body FROM notices ORDER BY rowid DESC LIMIT 200').all().map(r => JSON.parse(r.body)),
      timeRecords: this.meta('timeRecords', []), serverTime: this.at(),
    };
  }
  validate(kind, input) {
    const data = schemas[kind].parse(input);
    if ('plannedStart' in data) {
      requireThat(Boolean(data.plannedStart) === Boolean(data.plannedEnd), '排期必须同时填写开始和结束时间');
      if (data.plannedStart) requireThat(Date.parse(data.plannedEnd) > Date.parse(data.plannedStart), '结束时间必须晚于开始时间');
    }
    if (kind === 'task') {
      if (data.projectId) this.get('project', data.projectId);
      if (data.keyResultId) this.get('keyResult', data.keyResultId);
    }
    if (kind === 'keyResult') {
      this.get('objective', data.objectiveId);
      requireThat(data.target !== data.baseline, 'KR 目标值必须与起始值不同');
    }
    if (kind === 'plan') {
      requireThat(new Set(data.taskIds).size === data.taskIds.length, '计划中不能重复添加任务');
      data.taskIds.forEach(taskId => this.get('task', taskId));
    }
    return data;
  }
  create(kind, input, extra = {}) {
    const item = { ...this.validate(kind, input), ...extra, id: randomUUID(), revision: 1, createdAt: this.at(), updatedAt: this.at() };
    if (kind === 'task') Object.assign(item, { state: 'defining', sessionId: null });
    this.save(kind, item);
    if (kind === 'task') this.event(item.id, 'created');
    return item;
  }
  update(kind, item, input) {
    if (kind === 'task') requireThat(!['accepted', 'awaiting_acceptance', 'cancelled'].includes(item.state), '请先退回修改或重新打开任务，再编辑内容');
    const existing = Object.fromEntries(Object.keys(schemas[kind].shape).map(k => [k, item[k]]));
    const data = this.validate(kind, { ...existing, ...input });
    const result = this.save(kind, { ...item, ...data, revision: item.revision + 1, updatedAt: this.at() });
    if (kind === 'task') this.event(item.id, 'updated', { revision: result.revision });
    return result;
  }
  syncCodexProjects(projects) {
    return this.transaction(() => {
      const existing = this.all('project'); let added = 0, updated = 0;
      for (const project of projects) {
        const item = existing.find(item => item.codex?.projectId === project.projectId && item.codex.workspacePath === project.workspacePath);
        if (!item) { existing.push(this.create('project', { title: project.title }, { codex: { projectId: project.projectId, workspacePath: project.workspacePath } })); added++; }
        else if (item.title !== project.title) { this.update('project', item, { title: project.title }); updated++; }
      }
      return { count: projects.length, added, updated };
    });
  }
  dayPlans(day) { return this.all('plan').filter(plan => plan.date === day).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)); }
  addToDay(day, taskIds) {
    const plans = this.dayPlans(day), covered = new Set(plans.flatMap(plan => plan.taskIds));
    const added = taskIds.filter(taskId => !covered.has(taskId));
    if (!added.length) return;
    const primary = plans[0];
    if (primary) this.update('plan', primary, { taskIds: [...primary.taskIds, ...added] });
    else this.create('plan', { title: '今日计划', date: day, taskIds: added });
  }
  command(raw, authority = 'model') {
    const c = commandSchema.parse(raw);
    return this.transaction(() => {
      if (['create', 'create_tasks', 'promote'].includes(c.action)) {
        if (c.action === 'create') requireThat(!c.planDate || c.kind === 'task', '只有任务可以加入今日计划');
        const previous = this.db.prepare('SELECT body FROM requests WHERE id=?').get(c.requestId);
        const fingerprint = JSON.stringify(c.action === 'create' ? { kind: c.kind, data: c.data, ...(c.planDate ? { planDate: c.planDate } : {}) } : { ...c, requestId: undefined });
        const kind = c.action === 'create' ? c.kind : 'task';
        if (previous) {
          const saved = JSON.parse(previous.body);
          requireThat(saved.fingerprint === fingerprint, '同一 requestId 不能用于不同创建请求', 409);
          return c.action === 'create_tasks' ? { tasks: saved.entityIds.map(entityId => this.get(kind, entityId)) } : this.get(kind, saved.entityId);
        }
        let captured;
        if (c.action === 'promote') {
          captured = this.get('inbox', c.id); this.check(captured, c.revision);
          requireThat(!captured.archived, '请先恢复已归档的想法');
        }
        const items = (c.action === 'create_tasks' ? c.data : [c.data]).map(data => this.create(kind, data, captured ? { capture: { id: captured.id, title: captured.title, capturedAt: captured.createdAt } } : {}));
        if (c.planDate) this.addToDay(c.planDate, items.map(item => item.id));
        if (captured) this.db.prepare('DELETE FROM entities WHERE kind=? AND id=?').run('inbox', captured.id);
        this.db.prepare('INSERT INTO requests VALUES (?,?)').run(c.requestId, JSON.stringify({ fingerprint, entityId: items[0].id, ...(c.action === 'create_tasks' ? { entityIds: items.map(item => item.id) } : {}) }));
        return c.action === 'create_tasks' ? { tasks: items } : items[0];
      }
      if (c.action === 'daily_plan') {
        const plans = this.dayPlans(c.date);
        requireThat(c.plans.length === plans.length && new Set(c.plans.map(plan => plan.id)).size === plans.length && plans.every(plan => c.plans.some(read => read.id === plan.id && read.revision === plan.revision)), '今日计划已更新。请关闭并重新打开安排今天后重试。', 409);
        this.validate('plan', { title: '今日计划', date: c.date, taskIds: c.taskIds, note: c.note });
        const selected = new Set(c.taskIds), covered = new Set(plans.flatMap(plan => plan.taskIds));
        if (!plans.length) return { plans: [this.create('plan', { title: '今日计划', date: c.date, taskIds: c.taskIds, note: c.note })] };
        return { plans: plans.map((plan, index) => {
          const taskIds = plan.taskIds.filter(taskId => selected.has(taskId));
          if (!index) taskIds.push(...c.taskIds.filter(taskId => !covered.has(taskId)));
          const note = index ? plan.note : c.note;
          return JSON.stringify(taskIds) === JSON.stringify(plan.taskIds) && note === plan.note ? plan : this.update('plan', plan, { taskIds, note });
        }) };
      }
      if (c.action === 'update') {
        const item = this.get(c.kind, c.id); this.check(item, c.revision);
        if (item.codex && 'title' in c.data) requireThat(c.data.title === item.title, '项目名称由 Codex 维护，请在 Codex 中修改后同步。');
        return this.update(c.kind, item, c.data);
      }
      if (c.action === 'delete') {
        const item = this.get(c.kind, c.id); this.check(item, c.revision);
        const referenced = this.all('task').some(t => t.projectId === c.id || t.keyResultId === c.id)
          || this.all('keyResult').some(k => k.objectiveId === c.id) || this.all('plan').some(p => p.taskIds.includes(c.id));
        requireThat(!referenced, '请先移除相关任务、KR 或计划引用');
        if (c.kind === 'task') {
          requireThat(item.state === 'defining' && !item.sessionId && !this.meta('timeRecords', []).some(r => r.taskId === c.id) && this.focus().taskId !== c.id, '有执行或计时记录的任务请取消，保留审计记录');
          requireThat(this.taskHistory(c.id).every(e => ['created', 'updated'].includes(e.type)), '已有工作流记录的任务请取消，保留审计记录');
          this.db.prepare('DELETE FROM events WHERE task_id=?').run(c.id);
        }
        this.db.prepare('DELETE FROM entities WHERE id=?').run(c.id); return { deleted: c.id };
      }
      if (c.action === 'focus') return this.changeFocus(c);
      if (c.action === 'settings') {
        this.check(this.settings(), c.revision); return this.setMeta('settings', { ...c.data, revision: c.revision + 1 });
      }
      if (c.action === 'ack') {
        const row = this.db.prepare('SELECT body FROM notices WHERE id=?').get(c.id);
        requireThat(row, '提醒不存在', 404);
        const notice = { ...JSON.parse(row.body), read: true };
        this.db.prepare('UPDATE notices SET body=? WHERE id=?').run(JSON.stringify(notice), c.id); return notice;
      }
      const task = this.get('task', c.id); this.check(task, c.revision);
      if (c.action === 'bind') {
        requireThat(['defining', 'ready', 'changes_requested'].includes(task.state), '仅定义、就绪或待修改任务可绑定会话');
        if (task.sessionId && task.sessionId !== c.sessionId) requireThat(authority === 'human', '重新绑定必须由人在界面操作');
        if (c.sessionId) {
          requireThat(this.sessions().some(s => s.id === c.sessionId), '会话必须来自可信 Codex hook 事件；请启用并信任插件 hooks');
          requireThat(!this.all('task').some(t => t.id !== task.id && t.sessionId === c.sessionId && t.state !== 'cancelled'), '该会话已绑定任务，请继续使用原任务');
        }
        task.sessionId = c.sessionId;
      }
      if (c.action === 'transition') {
        const allowed = { defining: ['ready', 'cancelled'], ready: ['defining', 'executing', 'cancelled'], executing: ['cancelled'], changes_requested: ['ready', 'executing', 'cancelled'], cancelled: ['defining'], accepted: ['defining'] };
        requireThat(allowed[task.state]?.includes(c.state), `不能从 ${task.state} 变为 ${c.state}`);
        if (task.state === 'accepted') requireThat(authority === 'human', '重新打开已验收任务必须由人在界面操作');
        if (c.state === 'ready') requireThat(task.criteria.trim(), '请先填写验收标准');
        if (c.state === 'executing' && authority === 'model') requireThat(task.sessionId, 'AI 执行前必须绑定可信会话');
        if (c.state === 'cancelled') requireThat(this.focus().taskId !== task.id || this.focus().status === 'idle', '请先结束此任务的专注计时');
        task.state = c.state;
      }
      if (c.action === 'submit') {
        requireThat(task.state === 'executing', '只有执行中的任务可提交交付');
        for (const e of c.evidence) {
          requireThat(/^(https?:\/\/|\/|[A-Za-z]:[\\/])/.test(e.uri) && !/[\r\n]/.test(e.uri), '证据必须是 HTTP(S) URL 或本地绝对路径');
          if (/^https?:/.test(e.uri)) { const url = new URL(e.uri); requireThat(!url.username && !url.password, '证据 URL 不能包含凭据'); }
        }
        task.state = 'awaiting_acceptance';
        task.delivery = { summary: c.summary, evidence: c.evidence, submittedAt: this.at() };
      }
      task.revision += 1; task.updatedAt = this.at();
      this.save('task', task); this.event(task.id, c.action, { revision: task.revision, state: task.state, ...(c.action === 'submit' ? { delivery: task.delivery } : {}), ...(c.action === 'bind' ? { sessionId: task.sessionId } : {}) });
      return task;
    });
  }
  review(raw) {
    const c = reviewSchema.parse(raw);
    return this.transaction(() => {
      const task = this.get('task', c.id); this.check(task, c.revision);
      requireThat(task.state === 'awaiting_acceptance' && task.delivery?.evidence.length, '仅有交付证据的待验收任务可审阅');
      if (c.decision === 'reject') requireThat(c.note.trim(), '请填写退回原因');
      requireThat(this.focus().taskId !== task.id || this.focus().status === 'idle', '请先结束此任务的专注计时');
      task.state = c.decision === 'accept' ? 'accepted' : 'changes_requested';
      task.revision++; task.updatedAt = this.at();
      task.review = { decision: c.decision, reviewer: c.reviewer, note: c.note, at: this.at(), reviewedRevision: c.revision };
      this.save('task', task); this.event(task.id, 'review', { ...task.review, delivery: task.delivery }); return task;
    });
  }
  changeFocus(c) {
    const f = this.focus(); this.check(f, c.revision);
    const at = this.at();
    if (c.operation === 'start') {
      requireThat(f.status === 'idle', '请先结束当前专注');
      const task = this.get('task', c.taskId);
      requireThat(!['accepted', 'cancelled'].includes(task.state), '已结束的任务不能计时');
      Object.assign(f, { taskId: task.id, status: 'running', startedAt: at, elapsedMs: 0, segments: [] });
    } else {
      requireThat(f.status !== 'idle', '没有专注中的任务');
      if (c.operation === 'resume') { requireThat(f.status === 'paused', '只有暂停中的专注可恢复'); f.status = 'running'; f.startedAt = at; }
      else {
        if (c.operation === 'pause') requireThat(f.status === 'running', '只有运行中的专注可暂停');
        if (f.startedAt) {
          f.segments.push({ start: f.startedAt, end: at, durationMs: Math.max(0, this.now() - Date.parse(f.startedAt)) });
          f.elapsedMs = elapsed(f, this.now()); f.startedAt = null;
        }
        f.status = 'paused';
        if (c.operation === 'finish') {
          const record = { id: randomUUID(), taskId: f.taskId, endedAt: at, durationMs: f.elapsedMs, segments: f.segments };
          this.setMeta('timeRecords', [...this.meta('timeRecords', []), record]);
          this.event(f.taskId, 'focus', { durationMs: f.elapsedMs });
          Object.assign(f, { taskId: null, status: 'idle', elapsedMs: 0, startedAt: null, segments: [] });
        }
      }
    }
    f.revision++; return this.setMeta('focus', f);
  }
  observe(raw) {
    const event = z.object({ session_id: id, hook_event_name: z.enum(['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Stop', 'Interrupt', 'SessionEnd']), cwd: z.string().max(2000), turn_id: z.string().max(200).optional() }).parse(raw);
    return this.transaction(() => {
      const row = this.db.prepare('SELECT body FROM sessions WHERE id=?').get(event.session_id);
      const previous = row ? JSON.parse(row.body) : null;
      if (['Stop', 'Interrupt'].includes(event.hook_event_name) && previous?.turnId && event.turn_id && previous.turnId !== event.turn_id) return previous;
      const states = { SessionStart: 'idle', UserPromptSubmit: 'running', PreToolUse: 'running', PostToolUse: 'running', PermissionRequest: 'waiting', Stop: 'idle', Interrupt: 'interrupted', SessionEnd: 'ended' };
      const session = { id: event.session_id, cwd: event.cwd, observedState: states[event.hook_event_name], observedAt: this.at(), event: event.hook_event_name, turnId: event.turn_id ?? previous?.turnId ?? null, source: 'codex-hook' };
      this.db.prepare('INSERT OR REPLACE INTO sessions VALUES (?,?)').run(session.id, JSON.stringify(session)); return session;
    });
  }
  tick() {
    return this.transaction(() => {
      const s = this.settings(); const now = this.now();
      const add = (key, title, taskId = null) => {
        const notice = { id: randomUUID(), key, title, taskId, createdAt: this.at(), read: false };
        if (!this.db.prepare('SELECT id FROM notices WHERE json_extract(body,\'$.key\')=?').get(key)) this.db.prepare('INSERT INTO notices VALUES (?,?)').run(notice.id, JSON.stringify(notice));
      };
      for (const t of this.all('task').filter(t => !['accepted', 'cancelled'].includes(t.state))) {
        if (s.reminders && t.remindAt && Date.parse(t.remindAt) <= now) add(`reminder:${t.id}:${t.remindAt}`, `任务提醒：${t.title}`, t.id);
        if (s.followUpMinutes && t.state === 'executing') {
          const period = s.followUpMinutes * 60000;
          const slot = Math.floor((now - Date.parse(t.updatedAt)) / period);
          if (slot > 0) add(`follow:${t.id}:${t.updatedAt}:${slot}`, `进度跟进：${t.title}`, t.id);
        }
      }
      if (s.reviewTime) {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: s.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now)).map(p => [p.type, p.value]));
        if (`${parts.hour}:${parts.minute}` >= s.reviewTime) add(`review:${s.timezone}:${parts.year}-${parts.month}-${parts.day}:${s.reviewTime}`, '每日复盘：回顾交付、专注时间与明日计划');
      }
    });
  }
}
