import { afterEach, describe, expect, test } from "bun:test";
import {
  detectBackendName,
  getBackend,
  listBackendNames,
  registerBackend,
  resolveBackendName,
  unregisterBackend,
} from "../../src/backends/registry";
import { confStore } from "../../src/backends/stores";
import { canSplitPane, defineBackend, type MuxBackend } from "../../src/backends/types";

function createBackend(name: string, overrides: Partial<MuxBackend> = {}): MuxBackend {
  return defineBackend({
    name,
    getCurrentPaneId: async () => "1",
    paneExists: async () => true,
    focusPane: async () => {},
    sendText: async () => {},
    sendKey: async () => {},
    maxChunkBytes: 1024,
    defaultSubmitKey: "Enter",
    quoteSeparator: "\n",
    collectInput: "argument",
    storageNamespace: () => `state.${name}`,
    state: confStore(() => `state.${name}`),
    ...overrides,
  });
}

afterEach(() => {
  for (const name of ["mytty", "othertty"]) {
    if (listBackendNames().includes(name)) {
      unregisterBackend(name);
    }
  }
});

describe("backend registry", () => {
  test("registers the built-in backends", () => {
    expect(listBackendNames()).toEqual(["tmux", "wezterm", "herdr", "niwaterm", "rex"]);
    expect(getBackend("herdr").name).toBe("herdr");
  });

  test("registers and resolves an additional backend", () => {
    registerBackend(createBackend("mytty"));

    expect(resolveBackendName("mytty", {})).toBe("mytty");
    expect(resolveBackendName(undefined, { EDITPROMPT_MUX: "mytty" })).toBe("mytty");
  });

  test("rejects a duplicate backend name", () => {
    expect(() => registerBackend(createBackend("tmux"))).toThrow("already registered");
  });

  test("refuses to unregister a built-in backend", () => {
    expect(() => unregisterBackend("tmux")).toThrow("built-in");
  });

  test("detects built-in backends before additional ones", () => {
    registerBackend(createBackend("mytty", { detect: (env) => Boolean(env.MYTTY_PANE_ID) }));

    expect(detectBackendName({ MYTTY_PANE_ID: "1" })).toBe("mytty");
    expect(detectBackendName({ MYTTY_PANE_ID: "1", REX_BLOCK: "block:1" })).toBe("rex");
    expect(detectBackendName({})).toBe("tmux");
  });

  test("lists additional backends in the error for an unknown name", () => {
    registerBackend(createBackend("mytty"));

    expect(() => resolveBackendName("unknown", {})).toThrow(
      "Invalid multiplexer type 'unknown'. Supported values: tmux, wezterm, herdr, niwaterm, rex, mytty",
    );
  });
});

describe("canSplitPane", () => {
  test("requires splitPane, runInPane and closePane", () => {
    expect(canSplitPane(getBackend("herdr"))).toBe(true);
    expect(canSplitPane(getBackend("tmux"))).toBe(false);
    expect(
      canSplitPane(
        createBackend("mytty", { splitPane: async () => "2", runInPane: async () => {} }),
      ),
    ).toBe(false);
  });
});
