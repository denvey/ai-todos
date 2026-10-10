import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { commandSchema, sessionConfirmSchema } from './domain.js';
import { codexActionSchema } from './codex.js';
import { ensureService, service } from './service-client.js';
import { origin } from './paths.js';
await ensureService();
const icons = [{ src: `data:image/png;base64,${readFileSync(new URL('../assets/icon.png', import.meta.url)).toString('base64')}`, mimeType: 'image/png' }];
const server = new McpServer({ name: 'ai-todos', title: 'Todos', version: '0.1.2', icons });
const uri = 'ui://ai-todos/app.html';
const result = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });
const guarded = fn => async args => { try { return result(await fn(args)); } catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; } };
registerAppTool(server, 'ai_todos_open', {
  icons,
  title: '任务', description: 'Open the local ai-todos task, OKR, plan, focus and delivery workspace. If this host cannot render MCP Apps, open browserUrl in its browser.',
  inputSchema: z.object({}), annotations: { readOnlyHint: true, openWorldHint: false },
  _meta: { ui: { resourceUri: uri }, 'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] } },
}, guarded(async () => ({ ...await service('state'), browserUrl: origin })));
server.registerTool('ai_todos_snapshot', { description: 'Read persistent tasks, inbox captures, projects, OKRs, plans, trusted hook sessions, focus and reminders. Set syncThreads=true to refresh the official existing-session catalog before reading, for binding a host-created conversation. This does not create or execute conversations. Observed AI state is independent of task business state.', inputSchema: z.object({ syncThreads: z.boolean().optional() }), annotations: { readOnlyHint: true, openWorldHint: false }, _meta: { ui: { visibility: ['model', 'app'] } } }, guarded(async args => {
  if (args.syncThreads) await service('codex', { operation: 'sync_threads' });
  return service('state');
}));
server.registerTool('ai_todos_task', { description: 'Read one task and its delivery/acceptance history. Use the returned revision for a subsequent mutation. Never replace a human-reviewed revision with a newer one.', inputSchema: z.object({ id: z.string().uuid() }), annotations: { readOnlyHint: true, openWorldHint: false }, _meta: { ui: { visibility: ['model', 'app'] } } }, guarded(args => service('task', args)));
server.registerTool('ai_todos_manage', {
  description: 'Create/update/delete task, inbox capture, project, objective, keyResult or plan. create_tasks atomically creates tasks and adds them to planDate. promote converts an inbox capture to a task, optionally adding it to planDate. daily_plan selects the union of tasks for one date; plans must contain every plan ID and revision actually read for that date. Creation/promotion requestId is a UUID generated once and reused on retries. Bind only an official API-synced or hook-observed session ID; transition defining → ready → executing; submit real delivery summary and absolute-path/HTTP(S) evidence; manage persisted focus/settings/reminders. All updates require the revision actually read. Ready requires acceptance criteria. Stop is never delivery or acceptance. No accept/reject operation is available to AI: people must review evidence in the local UI. Do not infer acceptance, forge evidence or session IDs. Starting execution records intent and does not start Codex by itself.',
  inputSchema: z.object({ command: commandSchema }), annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }, _meta: { ui: { visibility: ['model', 'app'] } },
}, guarded(args => service('command', args.command)));
server.registerTool('ai_todos_codex', { description: 'Sync Codex projects and existing conversations, or generate a task definition suggestion for human preview. Suggestions do not save or execute tasks.', inputSchema: z.object({ action: codexActionSchema }), annotations: { readOnlyHint: false, openWorldHint: true }, _meta: { ui: { visibility: ['app'] } } }, guarded(args => service('codex', args.action)));
server.registerTool('ai_todos_confirm_session', { description: 'Record the human UI action confirming an unbound, stopped conversation complete at its displayed observation. This is not business task acceptance.', inputSchema: sessionConfirmSchema, annotations: { readOnlyHint: false, openWorldHint: false }, _meta: { ui: { visibility: ['app'] } } }, guarded(args => service('session-confirm', args)));
registerAppResource(server, 'ai-todos workspace', uri, { description: 'Persistent local productivity workspace' }, async () => ({ contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: readFileSync(new URL('../dist/app.html', import.meta.url), 'utf8').replaceAll('__AI_TODOS_ORIGIN__', origin), _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: false } } }] }));
const transport = new StdioServerTransport();
const send = transport.send.bind(transport);
// shortcut: SDK 1.32 drops tool icons; remove when registerTool preserves them.
transport.send = message => {
  const tool = message.result?.tools?.find(tool => tool.name === 'ai_todos_open');
  if (tool) tool.icons = icons;
  return send(message);
};
await server.connect(transport);
