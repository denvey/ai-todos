import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);

// scripts/stop.ts
import { readFileSync } from "node:fs";

// src/paths.ts
import { homedir } from "node:os";
import { join, resolve } from "node:path";
var dataDir = resolve(process.env.AI_TODOS_DATA_DIR || join(homedir(), ".ai-todos"));
var dbPath = join(dataDir, "ai-todos.sqlite");
var runtimePath = join(dataDir, "runtime.json");
var port = Number(process.env.AI_TODOS_PORT || 16943);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("AI_TODOS_PORT must be an integer between 1024 and 65535");
var origin = `http://127.0.0.1:${port}`;

// scripts/stop.ts
try {
  const runtime = JSON.parse(readFileSync(runtimePath, "utf8"));
  const response = await fetch(`${runtime.origin}/internal/stop`, { method: "POST", headers: { authorization: `Bearer ${runtime.token}` } });
  if (!response.ok) throw new Error("Stop failed");
  console.log("ai-todos stopped; data and timestamp-based focus state remain saved.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
