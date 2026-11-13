import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BridgeEvent, PullResult } from "../../src/core/bridge";
import { runBridge } from "../../src/modes/bridge";
import { pullPrompts } from "../../src/modes/pull";
import { createFakeBackend } from "../helpers/fakeBackend";

let socketDir: string;
const stops: (() => Promise<void>)[] = [];

beforeEach(() => {
  socketDir = mkdtempSync(join(tmpdir(), "ep-"));
});

afterEach(async () => {
  for (const stop of stops.splice(0)) {
    await stop();
  }
  rmSync(socketDir, { recursive: true, force: true });
});

function postAnswer(socketPath: string, id: number, result: PullResult): void {
  http
    .request({ socketPath, path: `/pull/${id}`, method: "POST" })
    .on("error", () => {})
    .end(JSON.stringify(result));
}

/**
 * Starts a bridge for a target pane with a fake agent behind it, which answers
 * each pull with `answer(keep)` and records the pulls it saw.
 */
async function startAgent(
  backend: ReturnType<typeof createFakeBackend>,
  targetPaneId: string,
  answer: (keep: boolean) => PullResult | undefined,
): Promise<{ pulls: boolean[]; stop: () => Promise<void> }> {
  const pulls: boolean[] = [];
  let socketPath = "";
  const stop = await runBridge(
    backend,
    targetPaneId,
    (event: BridgeEvent) => {
      if (event.type === "ready") {
        socketPath = event.socketPath;
        return;
      }
      pulls.push(event.keep);
      const result = answer(event.keep);
      if (result) {
        postAnswer(socketPath, event.id, result);
      }
    },
    socketDir,
  );
  stops.push(stop);
  return { pulls, stop };
}

describe("pullPrompts", () => {
  test("outputs the draft of each target pane and passes --keep on", async () => {
    const backend = createFakeBackend();
    const t1 = await startAgent(backend, "t1", (keep) => ({
      text: "fix the bug",
      source: "draft",
      isCleared: !keep,
    }));
    await startAgent(backend, "t2", () => ({
      text: "run the tests",
      source: "suggestion",
      isCleared: false,
    }));

    const outcome = await pullPrompts(backend, ["t1", "t2"], false);
    expect(outcome).toEqual({
      text: "fix the bug\nrun the tests",
      hasBridge: true,
      unclearedPaneIds: [],
    });

    await pullPrompts(backend, ["t1"], true);
    expect(t1.pulls).toEqual([false, true]);
  });

  test("reports a draft that could not be cleared", async () => {
    const backend = createFakeBackend();
    await startAgent(backend, "t1", () => ({ text: "draft", source: "draft", isCleared: false }));

    expect((await pullPrompts(backend, ["t1"], false)).unclearedPaneIds).toEqual(["t1"]);
    expect((await pullPrompts(backend, ["t1"], true)).unclearedPaneIds).toEqual([]);
  });

  test("tells a bridge with an empty prompt box from no bridge at all", async () => {
    const backend = createFakeBackend();
    await startAgent(backend, "t1", () => ({ text: "", source: "none", isCleared: false }));

    expect(await pullPrompts(backend, ["t1", "t2"], false)).toEqual({
      text: "",
      hasBridge: true,
      unclearedPaneIds: [],
    });
    expect((await pullPrompts(backend, ["t2"], false)).hasBridge).toBe(false);
  });

  test("skips a socket that no bridge listens on any more", async () => {
    const backend = createFakeBackend();
    await backend.state.setBridgeSocket("t1", join(socketDir, "gone.sock"));

    expect((await pullPrompts(backend, ["t1"], false)).hasBridge).toBe(false);
  });

  test("fails when the agent does not answer", async () => {
    const backend = createFakeBackend();
    await startAgent(backend, "t1", () => undefined);

    const error = await pullPrompts(backend, ["t1"], false).catch((error: unknown) => error);
    expect(error).toEqual(new Error("The agent did not answer"));
  }, 10000);
});

describe("runBridge", () => {
  test("forgets its socket when stopped", async () => {
    const backend = createFakeBackend();
    const { stop } = await startAgent(backend, "t1", () => undefined);
    expect(await backend.state.getBridgeSocket("t1")).not.toBe("");

    await stop();

    expect(await backend.state.getBridgeSocket("t1")).toBe("");
  });

  test("leaves the socket of the bridge that replaced it", async () => {
    const backend = createFakeBackend();
    const old = await startAgent(backend, "t1", () => undefined);
    await startAgent(backend, "t1", () => ({ text: "new", source: "draft", isCleared: true }));

    await old.stop();

    expect((await pullPrompts(backend, ["t1"], false)).text).toBe("new");
  });
});
