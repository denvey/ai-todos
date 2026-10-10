import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);

// scripts/open.js
import { spawn as spawn2 } from "node:child_process";

// src/service-client.js
import { fileURLToPath } from "node:url";
import { readFileSync, mkdirSync, openSync, closeSync } from "node:fs";
import { spawn } from "node:child_process";
import { join as join2 } from "node:path";

// src/paths.js
import { homedir } from "node:os";
import { join, resolve } from "node:path";
var dataDir = resolve(process.env.AI_TODOS_DATA_DIR || join(homedir(), ".ai-todos"));
var dbPath = join(dataDir, "ai-todos.sqlite");
var runtimePath = join(dataDir, "runtime.json");
var port = Number(process.env.AI_TODOS_PORT || 16943);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("AI_TODOS_PORT must be an integer between 1024 and 65535");
var origin = `http://127.0.0.1:${port}`;

// src/service-client.js
var runtime;
async function connect() {
  try {
    const candidate = JSON.parse(readFileSync(runtimePath, "utf8"));
    if (candidate.origin !== origin) throw new Error("Port does not match");
    const response = await fetch(`${origin}/internal/ping`, { headers: { authorization: `Bearer ${candidate.token}` }, signal: AbortSignal.timeout(600) });
    if (response.ok) {
      runtime = candidate;
      return true;
    }
  } catch {
  }
  return false;
}
async function ensureService() {
  if (await connect()) return runtime;
  mkdirSync(dataDir, { recursive: true, mode: 448 });
  const log = openSync(join2(dataDir, "service.log"), "a", 384);
  const child = spawn(process.execPath, [fileURLToPath(new URL("../src/server.js", import.meta.url))], { detached: true, stdio: ["ignore", log, log], env: process.env });
  child.on("error", () => {
  });
  child.unref();
  closeSync(log);
  for (let n = 0; n < 40; n++) {
    await new Promise((resolve2) => setTimeout(resolve2, 100));
    if (await connect()) return runtime;
  }
  throw new Error(`\u672C\u5730\u670D\u52A1\u542F\u52A8\u5931\u8D25\u3002\u8BF7\u67E5\u770B ${join2(dataDir, "service.log")}\uFF0C\u786E\u8BA4\u7AEF\u53E3 ${origin} \u672A\u88AB\u5176\u4ED6\u5E94\u7528\u5360\u7528\u3002`);
}

// scripts/open.js
var { origin: origin2 } = await ensureService();
console.log(origin2);
var command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
spawn2(command, [origin2], { stdio: "ignore" }).on("error", () => console.error("Open the URL above in your browser."));
