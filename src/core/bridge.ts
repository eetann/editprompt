import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The bridge between editprompt and an agent's prompt box.
 *
 * An agent integration (the Claude Code plugin) runs `editprompt bridge` for
 * the life of its session. The bridge listens on a Unix socket (a named pipe on
 * Windows), records the socket in the target pane's state, and writes one JSON
 * line to stdout per event (BridgeEvent). The integration answers each pull by
 * POSTing a PullResult to `/pull/<id>` on the same socket, which completes the
 * `editprompt pull` waiting on `GET /pull`.
 */

export type BridgeEvent =
  | { type: "ready"; socketPath: string }
  | { type: "pull"; id: number; keep: boolean };

export interface PullResult {
  /** The draft, the suggestion, or "" when the prompt box offers neither. */
  text: string;
  source: "draft" | "suggestion" | "none";
  /** True when the draft was taken out of the prompt box. */
  isCleared: boolean;
}

/** How long a pull waits for the integration's answer. */
export const PULL_TIMEOUT_MS = 2000;

function defaultSocketDir(): string {
  const runtimeDir = process.env.XDG_RUNTIME_DIR;
  if (runtimeDir) {
    return join(runtimeDir, "editprompt");
  }
  return join(tmpdir(), `editprompt-${process.getuid?.() ?? "user"}`);
}

/**
 * A fresh socket path for one bridge. Each bridge gets its own path, so a
 * bridge shutting down never removes the socket of the one that replaced it.
 * Unix socket paths are limited to about 100 bytes, so keep the directory short.
 */
export function createSocketPath(dir = defaultSocketDir()): string {
  const name = `bridge-${randomBytes(6).toString("hex")}`;
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\editprompt-${name}`;
  }
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return join(dir, `${name}.sock`);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export interface BridgeOptions {
  socketPath: string;
  /** Receives each event; `editprompt bridge` writes them to stdout. */
  emit(event: BridgeEvent): void;
  timeoutMs?: number;
}

/** Starts listening on the socket and emits `ready` once it accepts pulls. */
export function startBridge(options: BridgeOptions): Promise<http.Server> {
  const timeoutMs = options.timeoutMs ?? PULL_TIMEOUT_MS;
  const pending = new Map<number, http.ServerResponse>();
  let nextId = 1;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://bridge");

    if (req.method === "GET" && url.pathname === "/pull") {
      const id = nextId++;
      pending.set(id, res);
      setTimeout(() => {
        if (pending.delete(id)) {
          res.writeHead(504).end("The agent did not answer");
        }
      }, timeoutMs).unref();
      options.emit({ type: "pull", id, keep: url.searchParams.get("keep") === "1" });
      return;
    }

    const answer = url.pathname.match(/^\/pull\/(\d+)$/);
    if (req.method === "POST" && answer) {
      const body = await readBody(req);
      const id = Number(answer[1]);
      const waiting = pending.get(id);
      pending.delete(id);
      waiting?.writeHead(200, { "content-type": "application/json" }).end(body);
      res.writeHead(waiting ? 204 : 404).end();
      return;
    }

    res.writeHead(404).end();
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.socketPath, () => {
      server.off("error", reject);
      options.emit({ type: "ready", socketPath: options.socketPath });
      resolve(server);
    });
  });
}

/**
 * Asks the bridge at `socketPath` for the prompt box's content. Resolves
 * undefined when no bridge listens there (it exited or crashed).
 */
export function pullFromBridge(
  socketPath: string,
  options: { keep: boolean; timeoutMs?: number },
): Promise<PullResult | undefined> {
  const timeoutMs = (options.timeoutMs ?? PULL_TIMEOUT_MS) + 1000;
  return new Promise((resolve, reject) => {
    const req = http.get(
      { socketPath, path: options.keep ? "/pull?keep=1" : "/pull", timeout: timeoutMs },
      async (res) => {
        try {
          const body = await readBody(res);
          if (res.statusCode !== 200) {
            reject(new Error(body || `The bridge answered ${res.statusCode}`));
            return;
          }
          resolve(JSON.parse(body) as PullResult);
        } catch (error) {
          reject(error);
        }
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("The bridge did not answer"));
    });
    req.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT" || error.code === "ECONNREFUSED") {
        resolve(undefined);
        return;
      }
      reject(error);
    });
  });
}
