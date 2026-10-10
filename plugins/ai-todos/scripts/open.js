import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);

// scripts/open.ts
import { spawn as spawn2 } from "node:child_process";

// src/service-client.ts
import { fileURLToPath } from "node:url";
import { readFileSync, mkdirSync, openSync, closeSync } from "node:fs";
import { spawn } from "node:child_process";
import { join as join2 } from "node:path";

// src/paths.ts
import { homedir } from "node:os";
import { join, resolve } from "node:path";
var dataDir = resolve(process.env.AI_TODOS_DATA_DIR || join(homedir(), ".ai-todos"));
var dbPath = join(dataDir, "ai-todos.sqlite");
var runtimePath = join(dataDir, "runtime.json");
var port = Number(process.env.AI_TODOS_PORT || 16943);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("AI_TODOS_PORT must be an integer between 1024 and 65535");
var origin = `http://127.0.0.1:${port}`;

// package.json
var package_default = {
  name: "ai-todos",
  version: "0.1.5",
  private: true,
  type: "module",
  description: "Standalone local Codex productivity plugin",
  engines: {
    node: ">=24.0.0"
  },
  scripts: {
    build: "node scripts/build.ts",
    start: "node src/server.ts",
    open: "node scripts/open.ts",
    stop: "node scripts/stop.ts",
    mcp: "node src/mcp.ts",
    check: "node --test test/*.test.js",
    "package:plugin": "node scripts/package-plugin.ts",
    typecheck: "tsc --noEmit"
  },
  dependencies: {
    "@modelcontextprotocol/ext-apps": "2.0.3",
    "@modelcontextprotocol/sdk": "1.32.1",
    "@radix-ui/react-dialog": "1.1.19",
    "@radix-ui/react-popover": "1.1.19",
    "@radix-ui/react-select": "2.3.3",
    "lucide-react": "0.525.0",
    react: "19.1.1",
    "react-day-picker": "9.14.0",
    "react-dom": "19.1.1",
    zod: "4.6.5"
  },
  devDependencies: {
    "@types/node": "24.19.2",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    esbuild: "0.28.2",
    typescript: "7.0.2"
  }
};

// src/service-client.ts
var runtime;
async function connect() {
  try {
    const candidate = JSON.parse(readFileSync(runtimePath, "utf8"));
    if (candidate.origin !== origin) throw new Error("Port does not match");
    const response = await fetch(`${origin}/internal/ping`, { headers: { authorization: `Bearer ${candidate.token}` }, signal: AbortSignal.timeout(600) });
    if (response.ok) {
      const health = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(600) }).then((response2) => response2.json());
      if (health.name === "ai-todos" && typeof health.version === "string" && package_default.version.localeCompare(health.version, void 0, { numeric: true }) > 0) {
        const stopped = await fetch(`${origin}/internal/stop`, { method: "POST", headers: { authorization: `Bearer ${candidate.token}` }, signal: AbortSignal.timeout(1e3) });
        if (!stopped.ok) throw new Error("\u65E7\u670D\u52A1\u505C\u6B62\u5931\u8D25");
        return false;
      }
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
  const child = spawn(process.execPath, [fileURLToPath(new URL(import.meta.url.endsWith(".ts") ? "../src/server.ts" : "../src/server.js", import.meta.url))], { detached: true, stdio: ["ignore", log, log], env: process.env });
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

// scripts/open.ts
var { origin: origin2 } = await ensureService();
console.log(origin2);
var command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
spawn2(command, [origin2], { stdio: "ignore" }).on("error", () => console.error("Open the URL above in your browser."));
