import { describe, expect, test } from "bun:test";
import {
  focusFirstSuccessPane,
  handleContentDelivery,
  sendContentToPane,
  sendKeyToPane,
} from "../../src/core/delivery";
import { createFakeBackend } from "../helpers/fakeBackend";

describe("content delivery", () => {
  test("prepares the pane once and sends content in chunks", async () => {
    const backend = createFakeBackend("fake", {
      maxChunkBytes: 4,
      beforeSendText: async (paneId) => {
        backend.calls.push(["beforeSendText", paneId]);
      },
    });

    await sendContentToPane(backend, "t1", "abcdefghij");

    expect(backend.calls).toEqual([
      ["beforeSendText", "t1"],
      ["sendText", "t1", "abcd"],
      ["sendText", "t1", "efgh"],
      ["sendText", "t1", "ij"],
    ]);
  });

  test("lets the backend log the finished delivery", async () => {
    const logged: unknown[][] = [];
    const backend = createFakeBackend("fake", {
      maxChunkBytes: 4,
      logContentSent: (paneId, chunkCount) => {
        logged.push([paneId, chunkCount]);
      },
    });

    await sendContentToPane(backend, "t1", "abcdefghij");

    expect(logged).toEqual([["t1", 3]]);
  });

  test("sends a key after the delay", async () => {
    const backend = createFakeBackend();

    await sendKeyToPane(backend, "t1", "Enter", 0);

    expect(backend.calls).toEqual([["sendKey", "t1", "Enter"]]);
  });

  test("reports panes that failed to receive content", async () => {
    const backend = createFakeBackend("fake", {
      sendText: async (paneId) => {
        if (paneId === "t2") {
          throw new Error("gone");
        }
      },
    });

    const result = await handleContentDelivery("hello", backend, ["t1", "t2"]);

    expect(result).toEqual({
      successCount: 1,
      totalCount: 2,
      allSuccess: false,
      allFailed: false,
      failedPanes: ["t2"],
    });
  });

  test("focuses the first pane that received content", async () => {
    const backend = createFakeBackend();

    await focusFirstSuccessPane(backend, ["t1", "t2"], ["t1"]);

    expect(backend.calls).toEqual([["focusPane", "t2"]]);
  });
});
