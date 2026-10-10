import { readFileSync } from 'node:fs';
import { runtimePath } from '../src/paths.ts';
try {
  const runtime = JSON.parse(readFileSync(runtimePath, 'utf8'));
  const response = await fetch(`${runtime.origin}/internal/stop`, { method: 'POST', headers: { authorization: `Bearer ${runtime.token}` } });
  if (!response.ok) throw new Error('Stop failed');
  console.log('ai-todos stopped; data and timestamp-based focus state remain saved.');
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
