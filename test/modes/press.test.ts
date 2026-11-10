import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { registerBackend, unregisterBackend } from "../../src/backends/registry";
import { markAsEditorPane } from "../../src/core/link";
import { runPressMode } from "../../src/modes/press";
import { createFakeBackend, type FakeBackend } from "../helpers/fakeBackend";

let backend: FakeBackend;
const originalExit = process.exit.bind(process);

describe("runPressMode", () => {
  beforeEach(async () => {
    backend = createFakeBackend("fake-press");
    registerBackend(backend);
    await markAsEditorPane(backend, "editor", ["t1", "t2"]);

    process.env.EDITPROMPT_MUX = "fake-press";
    process.env.EDITPROMPT_ALWAYS_COPY = "0";
    process.env.EDITPROMPT_SEND_KEY_DELAY = "0";
  });

  afterEach(() => {
    unregisterBackend("fake-press");
    delete process.env.EDITPROMPT_MUX;
    process.exit = originalExit;
  });

  test("should exit with error when key is empty", async () => {
    const mockExit = mock(() => {});
    process.exit = mockExit as never;

    await runPressMode("", 0);

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test("should send key to all target panes", async () => {
    await runPressMode("Tab", 0);

    expect(backend.calls).toEqual([
      ["sendKey", "t1", "Tab"],
      ["sendKey", "t2", "Tab"],
    ]);
  });

  test("should exit with error when the current pane is not an editor pane", async () => {
    const mockExit = mock(() => {
      throw new Error("exit");
    });
    process.exit = mockExit as never;
    backend.currentPaneId = "t1";

    const error = await runPressMode("Tab", 0).catch((e: unknown) => e);

    expect(error).toEqual(new Error("exit"));
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(backend.calls).toEqual([]);
  });

  test("should exit with error when all panes fail", async () => {
    const mockExit = mock(() => {});
    process.exit = mockExit as never;
    const failing = createFakeBackend("fake-press-failing", {
      sendKey: async () => {
        throw new Error("pane not found");
      },
    });
    registerBackend(failing);
    await markAsEditorPane(failing, "editor", ["t1", "t2"]);
    process.env.EDITPROMPT_MUX = "fake-press-failing";

    try {
      await runPressMode("Tab", 0);
    } finally {
      unregisterBackend("fake-press-failing");
    }

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test("should not change focus after sending key", async () => {
    await runPressMode("1", 0);

    expect(backend.calls.some(([method]) => method === "focusPane")).toBe(false);
  });
});
