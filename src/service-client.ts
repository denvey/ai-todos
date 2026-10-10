import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { dataDir, runtimePath, origin } from './paths.ts';
import pkg from '../package.json' with { type: 'json' };
import type { ServiceRuntime } from './types.ts';
let runtime: ServiceRuntime;
async function connect() {
  try {
    const candidate = JSON.parse(readFileSync(runtimePath, 'utf8'));
    if (candidate.origin !== origin) throw new Error('Port does not match');
    const response = await fetch(`${origin}/internal/ping`, { headers: { authorization: `Bearer ${candidate.token}` }, signal: AbortSignal.timeout(600) });
    if (response.ok) {
      const health = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(600) }).then(response => response.json());
      if (health.name === 'ai-todos' && typeof health.version === 'string' && pkg.version.localeCompare(health.version, undefined, { numeric: true }) > 0) {
        const stopped = await fetch(`${origin}/internal/stop`, { method: 'POST', headers: { authorization: `Bearer ${candidate.token}` }, signal: AbortSignal.timeout(1000) });
        if (!stopped.ok) throw new Error('旧服务停止失败');
        return false;
      }
      runtime = candidate; return true;
    }
  } catch {}
  return false;
}
export async function ensureService() {
  if (await connect()) return runtime;
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const log = openSync(join(dataDir, 'service.log'), 'a', 0o600);
  const child = spawn(process.execPath, [fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? '../src/server.ts' : '../src/server.js', import.meta.url))], { detached: true, stdio: ['ignore', log, log], env: process.env });
  child.on('error', () => {}); child.unref(); closeSync(log);
  for (let n = 0; n < 40; n++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (await connect()) return runtime;
  }
  throw new Error(`本地服务启动失败。请查看 ${join(dataDir, 'service.log')}，确认端口 ${origin} 未被其他应用占用。`);
}
export async function service<T = Record<string, unknown>>(path: string, value?: unknown): Promise<T> {
  if (!runtime) await ensureService();
  const request = () => fetch(`${runtime.origin}/internal/${path}`, {
    method: value === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${runtime.token}`, 'content-type': 'application/json' },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }), signal: AbortSignal.timeout(path === 'codex' ? 130000 : 10000),
  });
  let response = await request();
  if (response.status === 401) { await ensureService(); response = await request(); }
  const result = await response.json(); if (!response.ok) throw new Error(result.error); return result;
}
