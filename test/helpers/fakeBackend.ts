import { paneVariableStore } from "../../src/backends/stores";
import { defineBackend, type MuxBackend } from "../../src/backends/types";

export interface FakeBackend extends MuxBackend {
  /** Every transport call, in order, as `[method, ...args]`. */
  calls: unknown[][];
  /** Pane IDs that paneExists() reports as alive. */
  livePanes: Set<string>;
  /** Pane variables backing the state store, keyed by `<pane>/<name>`. */
  variables: Map<string, string>;
  currentPaneId: string;
}

/**
 * An in-memory backend for testing modes and core logic without a real
 * multiplexer. Pane variables back its state.
 */
export function createFakeBackend(name = "fake", overrides: Partial<MuxBackend> = {}): FakeBackend {
  const calls: unknown[][] = [];
  const variables = new Map<string, string>();
  const fake = {
    calls,
    variables,
    livePanes: new Set<string>(),
    currentPaneId: "editor",
  };
  const backend = defineBackend({
    name,
    getCurrentPaneId: async () => fake.currentPaneId,
    paneExists: async (paneId: string) => fake.livePanes.has(paneId),
    focusPane: async (paneId: string) => {
      calls.push(["focusPane", paneId]);
    },
    sendText: async (paneId: string, chunk: string) => {
      calls.push(["sendText", paneId, chunk]);
    },
    sendKey: async (paneId: string, key: string) => {
      calls.push(["sendKey", paneId, key]);
    },
    maxChunkBytes: 1024,
    defaultSubmitKey: "Enter",
    quoteSeparator: "\n",
    collectInput: "argument",
    storageNamespace: () => name,
    state: paneVariableStore(
      {
        get: async (paneId, key) => variables.get(`${paneId}/${key}`) ?? "",
        set: async (paneId, key, value) => {
          variables.set(`${paneId}/${key}`, value);
        },
      },
      "",
    ),
    ...overrides,
  });
  return Object.assign(fake, backend) as FakeBackend;
}
