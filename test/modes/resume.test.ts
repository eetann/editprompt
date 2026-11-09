import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { registerBackend, unregisterBackend } from "../../src/backends/registry";
import type { MuxBackend } from "../../src/backends/types";
import { markAsEditorPane } from "../../src/core/link";
import { runResumeMode } from "../../src/modes/resume";
import { createFakeBackend } from "../helpers/fakeBackend";

const NAME = "fake-resume";
const originalExit = process.exit.bind(process);
let exitMock: ReturnType<typeof mock>;

async function setup(overrides: Partial<MuxBackend>) {
  const focusError = new Error("focus failed");
  const backend = createFakeBackend(NAME, {
    focusPane: async () => {
      throw focusError;
    },
    ...overrides,
  });
  registerBackend(backend);
  await markAsEditorPane(backend, "editor", ["t1"]);
  backend.currentPaneId = "t1";
  backend.livePanes.add("editor");
  return focusError;
}

beforeEach(() => {
  exitMock = mock(() => {
    throw new Error("exit");
  });
  process.exit = exitMock as never;
});

afterEach(() => {
  unregisterBackend(NAME);
  process.exit = originalExit;
});

describe("runResumeMode error handling", () => {
  test("lets the backend's error surface by default (tmux)", async () => {
    const focusError = await setup({});

    const error = await runResumeMode("t1", NAME).catch((e: unknown) => e);

    expect(error).toBe(focusError);
    expect(exitMock).not.toHaveBeenCalled();
  });

  test("exits 1 quietly on an editor focus failure (WezTerm, niwaterm)", async () => {
    await setup({ quietResumeErrors: "editorFocus" });

    await runResumeMode("t1", NAME).catch(() => {});

    expect(exitMock).toHaveBeenCalledWith(1);
  });

  test("lets other errors surface with editorFocus", async () => {
    const paneError = new Error("no pane");
    await setup({
      quietResumeErrors: "editorFocus",
      getCurrentPaneId: async () => {
        throw paneError;
      },
    });

    expect(await runResumeMode("t1", NAME).catch((e: unknown) => e)).toBe(paneError);
    expect(exitMock).not.toHaveBeenCalled();
  });

  test("exits 1 quietly on any failure (Herdr, Rex)", async () => {
    await setup({
      quietResumeErrors: "all",
      getCurrentPaneId: async () => {
        throw new Error("no pane");
      },
    });

    await runResumeMode("t1", NAME).catch(() => {});

    expect(exitMock).toHaveBeenCalledWith(1);
  });
});
