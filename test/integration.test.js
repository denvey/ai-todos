import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawnSync } from 'node:child_process';

async function freePort() { const s = createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const p = s.address().port; await new Promise(r => s.close(r)); return p; }

test('real STDIO tools/resource, local daemon, browser security, reviewed revision, packaged entry and trusted hook', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-todos-integration-')); const port = await freePort(); const origin = `http://127.0.0.1:${port}`;
  const env = { ...process.env, AI_TODOS_DATA_DIR: dir, AI_TODOS_PORT: String(port) };
  const client = new Client({ name: 'integration-check', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('src/mcp.js')], env, stderr: 'pipe' });
  let stderr = ''; transport.stderr?.on('data', d => { stderr += d; });
  t.after(async () => {
    await client.close();
    try { const r = JSON.parse(readFileSync(join(dir, 'runtime.json'), 'utf8')); await fetch(`${origin}/internal/stop`, { method: 'POST', headers: { authorization: `Bearer ${r.token}` } }); } catch {}
    await new Promise(r => setTimeout(r, 100)); rmSync(dir, { recursive: true, force: true });
  });
  await client.connect(transport);
  const tools = await client.listTools(); assert.equal(tools.tools.length, 6);
  assert.deepEqual(tools.tools.find(tool => tool.name === 'ai_todos_confirm_session')._meta.ui.visibility, ['app']);
  assert.ok(!tools.tools.some(t => /accept|review/.test(t.name)));
  const open = tools.tools.find(t => t.name === 'ai_todos_open'); assert.deepEqual(open._meta['openai/ui'].entrypoints, [{ type: 'global' }, { type: 'thread' }]);
  const resources = await client.listResources(); assert.equal(resources.resources[0].uri, 'ui://ai-todos/app.html');
  const resource = await client.readResource({ uri: 'ui://ai-todos/app.html' }); assert.equal(resource.contents[0].mimeType, 'text/html;profile=mcp-app'); assert.ok(resource.contents[0].text.includes(origin));
  const opened = await client.callTool({ name: 'ai_todos_open', arguments: {} }); assert.equal(opened.structuredContent.browserUrl, origin);
  const command = async c => {
    const result = await client.callTool({ name: 'ai_todos_manage', arguments: { command: c } });
    assert.ok(!result.isError, result.content?.[0]?.text); return result.structuredContent;
  };
  let task = await command({ action: 'create', kind: 'task', requestId: randomUUID(), data: { title: '协议检查', criteria: '有实际证据' } });
  const sessionId = randomUUID();
  const hook = spawnSync(process.execPath, ['hooks/observe.js'], { env, input: JSON.stringify({ session_id: sessionId, hook_event_name: 'UserPromptSubmit', cwd: '/tmp/check', turn_id: 'test-turn' }), encoding: 'utf8' });
  assert.equal(hook.status, 0); assert.ok(JSON.parse(hook.stdout).hookSpecificOutput.additionalContext.includes(sessionId));
  task = await command({ action: 'bind', id: task.id, revision: task.revision, sessionId });
  task = await command({ action: 'transition', id: task.id, revision: task.revision, state: 'ready' });
  task = await command({ action: 'transition', id: task.id, revision: task.revision, state: 'executing' });
  task = await command({ action: 'submit', id: task.id, revision: task.revision, summary: '协议真实调用成功', evidence: [{ label: '测试证据', uri: '/tmp/check.txt' }] });
  assert.equal((await client.callTool({ name: 'ai_todos_task', arguments: { id: task.id } })).structuredContent.task.state, 'awaiting_acceptance');
  const page = await fetch(origin); const cookie = page.headers.get('set-cookie').split(';')[0];
  assert.match(page.headers.get('content-security-policy'), /script-src 'sha256-/); assert.ok((await page.text()).includes('工作台'));
  assert.equal((await fetch(`${origin}/api/state`)).status, 401);
  assert.equal((await fetch(`${origin}/api/state`, { headers: { cookie, origin: 'https://evil.example' } })).status, 403);
  const snapshot = await (await fetch(`${origin}/api/state`, { headers: { cookie } })).json();
  const headers = { cookie, origin, 'x-csrf-token': snapshot.csrf, 'content-type': 'application/json' };
  const post = async (path, input) => fetch(`${origin}/api/${path}`, { method: 'POST', headers, body: JSON.stringify(input) });
  assert.equal((await fetch(`${origin}/api/command`, { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${origin}/internal/state`)).status, 401);
  const ticket = await (await post('review-ticket', { id: task.id, revision: task.revision })).json();
  assert.ok(ticket.ticket); const input = { ticket: ticket.ticket, id: task.id, revision: task.revision, decision: 'reject', confirmed: true, reviewer: 'Test human fixture', note: '验证退回' };
  assert.equal((await post('review', { ...input, note: '' })).status, 400);
  const accepted = await post('review', input); assert.equal(accepted.status, 200); task = await accepted.json();
  assert.equal((await post('review', input)).status, 409);
  task = await command({ action: 'transition', id: task.id, revision: task.revision, state: 'executing' });
  task = await command({ action: 'submit', id: task.id, revision: task.revision, summary: '修订交付', evidence: [{ label: '证据', uri: '/tmp/check.txt' }] });
  assert.equal((await post('review-ticket', { id: task.id, revision: ticket.task.revision })).status, 409);
  const packaged = new Client({ name: 'packaged-entry-check', version: '1' });
  await packaged.connect(new StdioClientTransport({ command: process.execPath, args: [resolve('plugins/ai-todos/src/mcp.js')], env, stderr: 'pipe' }));
  try { const result = await packaged.callTool({ name: 'ai_todos_snapshot', arguments: {} }); assert.equal(result.structuredContent.tasks[0].id, task.id); } finally { await packaged.close(); }
  assert.doesNotMatch(stderr, /TypeError|SyntaxError|ReferenceError/);
});
