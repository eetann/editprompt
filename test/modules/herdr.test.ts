import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HERDR_SEND_CHUNK_BYTES } from "../../src/config/constants";
import { conf } from "../../src/modules/conf";
import { herdrBackend } from "../../src/backends/herdr";
import { sendContentToPane, sendKeyToPane } from "../../src/core/delivery";
import {
  clearEditorLink,
  getEditorPaneId,
  getTargetPaneIds,
  isEditorPane,
  markAsEditorPane,
} from "../../src/core/link";
import { appendQuote } from "../../src/core/quote";
import { switchEditorFocus } from "../../src/core/resume";
import {
  calculateEditorSplitRatio,
  checkPaneExists,
  closePane,
  focusPane,
  getCurrentPaneId,
  runCommandInPane,
  splitEditorPane,
} from "../../src/modules/herdr";

interface HerdrRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

let server: Server | undefined;
let tempDirectory: string | undefined;
let originalEnv: NodeJS.ProcessEnv;

async function startServer(
  handler: (request: HerdrRequest) => Record<string, unknown>,
): Promise<HerdrRequest[]> {
  tempDirectory = await mkdtemp(join(tmpdir(), "editprompt-herdr-test-"));
  const socketPath = join(tempDirectory, "herdr.sock");
  const requests: HerdrRequest[] = [];

  server = createServer((socket) => {
    socket.setEncoding("utf8");
    let buffer = "";
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line) {
          continue;
        }
        const request = JSON.parse(line) as HerdrRequest;
        requests.push(request);
        socket.write(`${JSON.stringify({ id: request.id, ...handler(request) })}\n`);
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server?.once("error", reject);
    server?.listen(socketPath, resolve);
  });
  process.env.HERDR_SOCKET_PATH = socketPath;
  return requests;
}

beforeEach(() => {
  originalEnv = { ...process.env };
  process.env.HERDR_SOCKET_PATH = "/tmp/editprompt-herdr-test.sock";
  conf.clear();
});

afterEach(async () => {
  process.env = originalEnv;
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    server = undefined;
  }
  if (tempDirectory) {
    await rm(tempDirectory, { recursive: true });
    tempDirectory = undefined;
  }
});

describe("Herdr pane API", () => {
  test("gets the current pane ID from a Herdr pane environment", async () => {
    process.env.HERDR_PANE_ID = "w1:p2";

    expect(await getCurrentPaneId()).toBe("w1:p2");
  });

  test("gets the active pane ID from a detached Herdr command", async () => {
    delete process.env.HERDR_PANE_ID;
    process.env.HERDR_ACTIVE_PANE_ID = "w1:p3";

    expect(await getCurrentPaneId()).toBe("w1:p3");
  });

  test("throws when the current pane ID is unavailable", async () => {
    delete process.env.HERDR_PANE_ID;
    delete process.env.HERDR_ACTIVE_PANE_ID;

    let thrown: unknown;
    try {
      await getCurrentPaneId();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("HERDR_PANE_ID or HERDR_ACTIVE_PANE_ID is not set");
  });

  test("checks pane existence through pane.get", async () => {
    const requests = await startServer(() => ({
      result: { type: "pane_info", pane: { pane_id: "w1:p2" } },
    }));

    expect(await checkPaneExists("w1:p2")).toBe(true);
    expect(requests[0]).toMatchObject({
      method: "pane.get",
      params: { pane_id: "w1:p2" },
    });
  });

  test("returns false when pane.get returns an error", async () => {
    await startServer(() => ({
      error: { code: "pane_not_found", message: "pane not found" },
    }));

    expect(await checkPaneExists("w1:p9")).toBe(false);
  });

  test("focuses a pane through pane.focus", async () => {
    const requests = await startServer(() => ({ result: { type: "pane_info" } }));

    await focusPane("w1:p2");

    expect(requests[0]).toMatchObject({
      method: "pane.focus",
      params: { pane_id: "w1:p2" },
    });
  });

  test("sends text and keys without shell escaping", async () => {
    const requests = await startServer(() => ({ result: { type: "ok" } }));
    const content = "hello 'herdr'\n日本語";

    await sendContentToPane(herdrBackend, "w1:p2", content);
    await sendKeyToPane(herdrBackend, "w1:p2", "enter", 0);

    expect(requests[0]).toMatchObject({
      method: "pane.send_text",
      params: { pane_id: "w1:p2", text: content },
    });
    expect(requests[1]).toMatchObject({
      method: "pane.send_keys",
      params: { pane_id: "w1:p2", keys: ["enter"] },
    });
  });

  test("splits text across requests below Herdr's request limit", async () => {
    const requests = await startServer(() => ({ result: { type: "ok" } }));
    const content = `先頭${"a".repeat(HERDR_SEND_CHUNK_BYTES)}末尾`;

    await sendContentToPane(herdrBackend, "w1:p2", content);

    expect(requests.length).toBeGreaterThan(1);
    expect(requests.every((request) => request.method === "pane.send_text")).toBe(true);
    expect(requests.map((request) => String(request.params.text)).join("")).toBe(content);
  });

  test("calculates a 12-row editor split within Herdr ratio limits", () => {
    expect(calculateEditorSplitRatio(65, 12)).toBeCloseTo(0.815384, 5);
    expect(calculateEditorSplitRatio(131, 12)).toBe(0.9);
    expect(calculateEditorSplitRatio(10, 12)).toBe(0.1);
  });

  test("creates a focused bottom split using the target pane height", async () => {
    const requests = await startServer((request) => {
      if (request.method === "pane.layout") {
        return {
          result: {
            type: "pane_layout",
            layout: {
              panes: [{ pane_id: "w1:p1", rect: { height: 65 } }],
            },
          },
        };
      }
      return {
        result: {
          type: "pane_info",
          pane: { pane_id: "w1:p2" },
        },
      };
    });

    expect(
      await splitEditorPane("w1:p1", 12, "/repo with spaces", {
        NODE_NO_WARNINGS: "1",
      }),
    ).toBe("w1:p2");
    expect(requests[0]).toMatchObject({
      method: "pane.layout",
      params: { pane_id: "w1:p1" },
    });
    expect(requests[1]).toMatchObject({
      method: "pane.split",
      params: {
        target_pane_id: "w1:p1",
        direction: "down",
        ratio: 1 - 12 / 65,
        focus: true,
        cwd: "/repo with spaces",
        env: { NODE_NO_WARNINGS: "1" },
      },
    });
  });

  test("splits from the backend in the active pane's working directory", async () => {
    process.env.HERDR_ACTIVE_PANE_CWD = "/repo";
    const requests = await startServer((request) => {
      if (request.method === "pane.layout") {
        return {
          result: {
            type: "pane_layout",
            layout: { panes: [{ pane_id: "w1:p1", rect: { height: 65 } }] },
          },
        };
      }
      return { result: { type: "pane_info", pane: { pane_id: "w1:p2" } } };
    });

    expect(await herdrBackend.splitPane("w1:p1", { rows: 12, env: {} })).toBe("w1:p2");
    expect(requests[1]).toMatchObject({ method: "pane.split", params: { cwd: "/repo" } });
  });

  test("runs an argv command safely and closes panes through the socket API", async () => {
    const requests = await startServer(() => ({ result: { type: "ok" } }));

    await runCommandInPane("w1:p2", [
      "node",
      "/repo with spaces/dist/index.js",
      "--env",
      "VALUE=it's safe",
    ]);
    await closePane("w1:p2");

    expect(requests[0]).toMatchObject({
      method: "pane.send_input",
      params: {
        pane_id: "w1:p2",
        text: "exec 'node' '/repo with spaces/dist/index.js' '--env' 'VALUE=it'\\''s safe'",
        keys: ["Enter"],
      },
    });
    expect(requests[1]).toMatchObject({
      method: "pane.close",
      params: { pane_id: "w1:p2" },
    });
  });
});

describe("Herdr editor state", () => {
  test("registers an editor pane with unique target panes", async () => {
    await markAsEditorPane(herdrBackend, "w1:p3", ["w1:p1", "w1:p2", "w1:p1"]);

    expect(await isEditorPane(herdrBackend, "w1:p3")).toBe(true);
    expect(await getTargetPaneIds(herdrBackend, "w1:p3")).toEqual(["w1:p1", "w1:p2"]);
    expect(await getEditorPaneId(herdrBackend, "w1:p1")).toBe("w1:p3");
    expect(await getEditorPaneId(herdrBackend, "w1:p2")).toBe("w1:p3");
  });

  test("clears editor state while preserving quote text", async () => {
    await markAsEditorPane(herdrBackend, "w1:p3", ["w1:p1"]);
    await appendQuote(herdrBackend, "w1:p1", "> quote\n\n");

    await clearEditorLink(herdrBackend, "w1:p1");

    expect(await isEditorPane(herdrBackend, "w1:p3")).toBe(false);
    expect(await getEditorPaneId(herdrBackend, "w1:p1")).toBe("");
    expect(await herdrBackend.state.getQuote("w1:p1")).toBe("> quote\n\n");
  });

  test("does not clear a newer editor registration when an older editor exits", async () => {
    await markAsEditorPane(herdrBackend, "w1:p2", ["w1:p1"]);
    await markAsEditorPane(herdrBackend, "w1:p3", ["w1:p1"]);

    await clearEditorLink(herdrBackend, "w1:p1", "w1:p2");

    expect(await isEditorPane(herdrBackend, "w1:p2")).toBe(false);
    expect(await isEditorPane(herdrBackend, "w1:p3")).toBe(true);
    expect(await getEditorPaneId(herdrBackend, "w1:p1")).toBe("w1:p3");
  });

  test("appends and clears quote text while preserving editor state", async () => {
    await markAsEditorPane(herdrBackend, "w1:p3", ["w1:p1"]);

    await appendQuote(herdrBackend, "w1:p1", "> first\n\n");
    await appendQuote(herdrBackend, "w1:p1", "> second\n\n");

    expect(await herdrBackend.state.getQuote("w1:p1")).toBe("> first\n\n\n\n> second\n\n");

    await herdrBackend.state.removeQuote("w1:p1");

    expect(await herdrBackend.state.getQuote("w1:p1")).toBe("");
    expect(await getEditorPaneId(herdrBackend, "w1:p1")).toBe("w1:p3");
  });

  test("isolates editor state between Herdr sessions", async () => {
    process.env.HERDR_SOCKET_PATH = "/tmp/herdr-session-a.sock";
    await markAsEditorPane(herdrBackend, "w1:p3", ["w1:p1"]);

    process.env.HERDR_SOCKET_PATH = "/tmp/herdr-session-b.sock";

    expect(await isEditorPane(herdrBackend, "w1:p3")).toBe(false);
    expect(await getEditorPaneId(herdrBackend, "w1:p1")).toBe("");
  });

  test("resumes a registered editor pane from its target pane", async () => {
    process.env.HERDR_PANE_ID = "w1:p1";
    const requests = await startServer((request) => {
      if (request.method === "pane.get") {
        return { result: { type: "pane_info", pane: { pane_id: "w1:p2" } } };
      }
      return { result: { type: "ok" } };
    });
    await markAsEditorPane(herdrBackend, "w1:p2", ["w1:p1"]);

    expect(await switchEditorFocus(herdrBackend, "w1:p1")).toBe(true);
    expect(requests.map((request) => request.method)).toEqual(["pane.get", "pane.focus"]);
    expect(requests[1]?.params).toEqual({ pane_id: "w1:p2" });
  });

  test("returns false when no editor pane is registered", async () => {
    process.env.HERDR_PANE_ID = "w1:p1";

    expect(await switchEditorFocus(herdrBackend, "w1:p1")).toBe(false);
  });
});
