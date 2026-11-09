import { describe, expect, test } from "bun:test";
import type { MuxBackend } from "../../src/backends/types";
import { markAsEditorPane } from "../../src/core/link";
import { buildOpenEditorArgv, runToggleMode, type ToggleModeOptions } from "../../src/modes/toggle";
import { createFakeBackend, type FakeBackend } from "../helpers/fakeBackend";

function createSplitBackend(overrides: Partial<MuxBackend> = {}): FakeBackend {
  const backend: FakeBackend = createFakeBackend("fake-split", {
    splitPane: async (targetPaneId, options) => {
      backend.calls.push(["splitPane", targetPaneId, options]);
      return "w1:p2";
    },
    runInPane: async (paneId, argv) => {
      backend.calls.push(["runInPane", paneId, argv]);
    },
    closePane: async (paneId) => {
      backend.calls.push(["closePane", paneId]);
    },
    ...overrides,
  });
  return backend;
}

function createOptions(overrides: Partial<ToggleModeOptions> = {}): ToggleModeOptions {
  return {
    mux: "herdr",
    targetPane: "w1:p1",
    paneRows: 12,
    alwaysCopy: true,
    editor: "nvim",
    env: ["NVIM_NOTTYFAST=1"],
    quiet: true,
    verbose: false,
    invocation: {
      execPath: "/usr/local/bin/node",
      scriptPath: "/repo with spaces/dist/index.js",
    },
    ...overrides,
  };
}

describe("toggle mode", () => {
  test("builds an open command using the current editprompt entrypoint", () => {
    expect(buildOpenEditorArgv(createOptions())).toEqual([
      "/usr/local/bin/node",
      "/repo with spaces/dist/index.js",
      "open",
      "--mux",
      "herdr",
      "--target-pane",
      "w1:p1",
      "--editor",
      "nvim",
      "--always-copy",
      "--env",
      "NVIM_NOTTYFAST=1",
      "--quiet",
    ]);
  });

  test("focuses an existing editor without creating a split", async () => {
    const backend = createSplitBackend();
    await markAsEditorPane(backend, "w1:p2", ["w1:p1"]);
    backend.currentPaneId = "w1:p1";
    backend.livePanes.add("w1:p2");

    await runToggleMode(createOptions(), backend);

    expect(backend.calls).toEqual([["focusPane", "w1:p2"]]);
  });

  test("creates a split and runs open when no editor exists", async () => {
    const originalNodeWarnings = process.env.NODE_NO_WARNINGS;
    process.env.NODE_NO_WARNINGS = "1";
    const backend = createSplitBackend();
    backend.currentPaneId = "w1:p1";

    try {
      const options = createOptions();
      await runToggleMode(options, backend);

      expect(backend.calls).toEqual([
        ["splitPane", "w1:p1", { rows: 12, env: { NODE_NO_WARNINGS: "1" } }],
        ["runInPane", "w1:p2", buildOpenEditorArgv(options)],
      ]);
    } finally {
      if (originalNodeWarnings === undefined) {
        delete process.env.NODE_NO_WARNINGS;
      } else {
        process.env.NODE_NO_WARNINGS = originalNodeWarnings;
      }
    }
  });

  test("closes a newly-created pane when command launch fails", async () => {
    const launchError = new Error("launch failed");
    const backend = createSplitBackend({
      runInPane: async () => {
        throw launchError;
      },
    });
    backend.currentPaneId = "w1:p1";

    let thrown: unknown;
    try {
      await runToggleMode(createOptions(), backend);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBe(launchError);
    expect(backend.calls).toContainEqual(["closePane", "w1:p2"]);
  });

  test("rejects backends that cannot split panes and invalid row counts", async () => {
    let muxError: unknown;
    let rowsError: unknown;
    try {
      await runToggleMode(createOptions({ mux: "tmux" }));
    } catch (error) {
      muxError = error;
    }
    try {
      await runToggleMode(createOptions({ paneRows: 0 }), createSplitBackend());
    } catch (error) {
      rowsError = error;
    }

    expect(muxError).toBeInstanceOf(Error);
    expect((muxError as Error).message).toBe(
      "toggle currently supports only the Herdr multiplexer",
    );
    expect(rowsError).toBeInstanceOf(Error);
    expect((rowsError as Error).message).toBe("--pane-rows must be a positive integer");
  });

  test("names a configured backend that cannot split panes", async () => {
    let thrown: unknown;
    try {
      await runToggleMode(createOptions({ mux: "mytty" }), createFakeBackend("mytty"));
    } catch (error) {
      thrown = error;
    }

    expect((thrown as Error).message).toBe(
      "toggle is not supported by the 'mytty' multiplexer because it cannot split panes",
    );
  });

  test("works with any backend that can split panes", async () => {
    const backend = createSplitBackend();
    backend.currentPaneId = "w1:p1";

    await runToggleMode(createOptions({ mux: "fake-split" }), backend);

    expect(backend.calls.map(([method]) => method)).toEqual(["splitPane", "runInPane"]);
  });
});
