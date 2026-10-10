import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
export const dataDir = resolve(process.env.AI_TODOS_DATA_DIR || join(homedir(), '.ai-todos'));
export const dbPath = join(dataDir, 'ai-todos.sqlite');
export const runtimePath = join(dataDir, 'runtime.json');
export const port = Number(process.env.AI_TODOS_PORT || 16943);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('AI_TODOS_PORT must be an integer between 1024 and 65535');
export const origin = `http://127.0.0.1:${port}`;
