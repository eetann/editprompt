import { getLogger, type Logger } from "@logtape/logtape";
import { conf } from "../modules/conf";
import type { PaneStateStore } from "./types";

/** Reads and writes one variable on one pane. */
export interface PaneVariableIO {
  /** Returns the raw value, or "" when the variable is unset or unreadable. */
  get(paneId: string, name: string): Promise<string>;
  set(paneId: string, name: string, value: string): Promise<void>;
}

const VAR_EDITOR_PANE = "editor_pane";
const VAR_IS_EDITOR = "is_editor";
const VAR_TARGET_PANES = "target_panes";
const VAR_QUOTE = "quote";
const VAR_SUGGESTION = "suggestion";

/**
 * State kept in variables on the panes themselves (tmux pane options, niwaterm
 * tab variables). Variable names are `<prefix>editor_pane`, `<prefix>is_editor`,
 * `<prefix>target_panes`, `<prefix>quote` and `<prefix>suggestion`.
 *
 * The variables disappear with their pane, so forgetting an editor pane is a
 * no-op here: only the link on the target pane is cleared.
 */
export function paneVariableStore(io: PaneVariableIO, prefix: string): PaneStateStore {
  const name = (key: string) => `${prefix}${key}`;
  const read = async (paneId: string, key: string) => (await io.get(paneId, name(key))).trim();

  return {
    getEditorPaneId: (targetPaneId) => read(targetPaneId, VAR_EDITOR_PANE),
    setEditorPaneId: (targetPaneId, editorPaneId) =>
      io.set(targetPaneId, name(VAR_EDITOR_PANE), editorPaneId),
    removeEditorPaneId: (targetPaneId) => io.set(targetPaneId, name(VAR_EDITOR_PANE), ""),

    isEditorPane: async (paneId) => (await read(paneId, VAR_IS_EDITOR)) === "1",
    getTargetPaneIds: async (editorPaneId) => {
      const value = await read(editorPaneId, VAR_TARGET_PANES);
      if (value === "") {
        return [];
      }
      return value.split(",").map((id) => id.trim());
    },
    setTargetPaneIds: async (editorPaneId, targetPaneIds) => {
      await io.set(editorPaneId, name(VAR_IS_EDITOR), "1");
      await io.set(editorPaneId, name(VAR_TARGET_PANES), targetPaneIds.join(","));
    },
    removeEditorPane: async () => {},
    keepsEditorPaneMarks: true,

    // The quote is returned as stored: trailing blank lines are significant.
    getQuote: (targetPaneId) => io.get(targetPaneId, name(VAR_QUOTE)),
    setQuote: (targetPaneId, text) => io.set(targetPaneId, name(VAR_QUOTE), text),
    removeQuote: (targetPaneId) => io.set(targetPaneId, name(VAR_QUOTE), ""),

    getSuggestion: (targetPaneId) => io.get(targetPaneId, name(VAR_SUGGESTION)),
    setSuggestion: (targetPaneId, text) => io.set(targetPaneId, name(VAR_SUGGESTION), text),
    removeSuggestion: (targetPaneId) => io.set(targetPaneId, name(VAR_SUGGESTION), ""),
  };
}

type ConfRecord = Record<string, unknown>;

function readRecord(key: string): ConfRecord | undefined {
  const data = conf.get(key);
  return typeof data === "object" && data !== null && !Array.isArray(data)
    ? (data as ConfRecord)
    : undefined;
}

function setField(key: string, field: string, value: unknown): void {
  conf.set(key, { ...readRecord(key), [field]: value });
}

function removeField(key: string, field: string): void {
  const data = readRecord(key);
  if (!data || !(field in data)) {
    return;
  }
  const { [field]: _, ...remaining } = data;
  if (Object.keys(remaining).length === 0) {
    conf.delete(key);
  } else {
    conf.set(key, remaining);
  }
}

export interface ConfStoreOptions {
  /**
   * Write the target pane record as a whole, the way the WezTerm backend
   * always has: linking an editor pane replaces the record, unlinking deletes
   * it (the quote buffer included), and clearing the quote only deletes the
   * `quote_text` field, leaving an empty record behind. Failures are logged
   * at debug level, under `logCategory` and the WezTerm module's original
   * function names, and swallowed. Kept so that WezTerm behaves exactly as
   * before; new backends should not set it.
   */
  wholeTargetRecord?: boolean;
  /** Logger category for wholeTargetRecord's debug logs. */
  logCategory?: readonly string[];
}

/**
 * State kept in editprompt's Conf storage, for backends whose panes cannot hold
 * variables. The layout is:
 *
 * - `<namespace>.targetPane.pane_<id>`: `{ editorPaneId?, quote_text?, suggestion_text? }`
 * - `<namespace>.editorPane.pane_<id>`: `{ targetPaneIds }`
 *
 * The namespace is resolved on every access so that it can depend on the
 * environment (Herdr scopes it to the session socket).
 */
export function confStore(namespace: () => string, options: ConfStoreOptions = {}): PaneStateStore {
  const targetKey = (paneId: string) => `${namespace()}.targetPane.pane_${paneId}`;
  const editorKey = (paneId: string) => `${namespace()}.editorPane.pane_${paneId}`;

  const store: PaneStateStore = {
    getEditorPaneId: async (targetPaneId) => {
      const data = readRecord(targetKey(targetPaneId));
      return data && "editorPaneId" in data ? String(data.editorPaneId) : "";
    },
    setEditorPaneId: async (targetPaneId, editorPaneId) => {
      setField(targetKey(targetPaneId), "editorPaneId", editorPaneId);
    },
    removeEditorPaneId: async (targetPaneId) => {
      removeField(targetKey(targetPaneId), "editorPaneId");
    },

    isEditorPane: async (paneId) => conf.has(editorKey(paneId)),
    getTargetPaneIds: async (editorPaneId) => {
      const targetPaneIds = readRecord(editorKey(editorPaneId))?.targetPaneIds;
      return Array.isArray(targetPaneIds) ? targetPaneIds.map((id) => String(id)) : [];
    },
    setTargetPaneIds: async (editorPaneId, targetPaneIds) => {
      conf.set(editorKey(editorPaneId), { targetPaneIds });
    },
    removeEditorPane: async (editorPaneId) => {
      conf.delete(editorKey(editorPaneId));
    },

    getQuote: async (targetPaneId) => {
      const data = readRecord(targetKey(targetPaneId));
      return data && "quote_text" in data ? String(data.quote_text) : "";
    },
    setQuote: async (targetPaneId, text) => {
      setField(targetKey(targetPaneId), "quote_text", text);
    },
    removeQuote: async (targetPaneId) => {
      removeField(targetKey(targetPaneId), "quote_text");
    },

    getSuggestion: async (targetPaneId) => {
      const data = readRecord(targetKey(targetPaneId));
      return data && "suggestion_text" in data ? String(data.suggestion_text) : "";
    },
    setSuggestion: async (targetPaneId, text) => {
      setField(targetKey(targetPaneId), "suggestion_text", text);
    },
    removeSuggestion: async (targetPaneId) => {
      removeField(targetKey(targetPaneId), "suggestion_text");
    },
  };

  if (!options.wholeTargetRecord) {
    return store;
  }
  const logger = getLogger([...(options.logCategory ?? ["editprompt", "state"])]);
  return swallowErrors(logger, {
    ...store,
    setEditorPaneId: async (targetPaneId, editorPaneId) => {
      logger.debug(
        `Saving editor pane ID to conf key: ${namespace()}.targetPane.pane_{targetPaneId}`,
        {
          targetPaneId,
        },
      );
      conf.set(targetKey(targetPaneId), { editorPaneId });
    },
    removeEditorPaneId: async (targetPaneId) => {
      conf.delete(targetKey(targetPaneId));
    },
    removeQuote: async (targetPaneId) => {
      const key = `${targetKey(targetPaneId)}.quote_text`;
      if (conf.has(key)) {
        conf.delete(key);
      }
    },
  });
}

type StoreMethod = Exclude<keyof PaneStateStore, "keepsEditorPaneMarks">;

const FAILURE_RESULTS: { [K in StoreMethod]: Awaited<ReturnType<PaneStateStore[K]>> } = {
  getEditorPaneId: "",
  setEditorPaneId: undefined,
  removeEditorPaneId: undefined,
  isEditorPane: false,
  getTargetPaneIds: [],
  setTargetPaneIds: undefined,
  removeEditorPane: undefined,
  getQuote: "",
  setQuote: undefined,
  removeQuote: undefined,
  getSuggestion: "",
  setSuggestion: undefined,
  removeSuggestion: undefined,
};

// The WezTerm module's function names, used in its failure logs.
const LEGACY_METHOD_NAMES: { [K in StoreMethod]: string } = {
  getEditorPaneId: "getEditorPaneId",
  setEditorPaneId: "saveEditorPaneId",
  removeEditorPaneId: "clearEditorPaneId",
  isEditorPane: "isEditorPaneFromConf",
  getTargetPaneIds: "getTargetPaneIds",
  setTargetPaneIds: "markAsEditorPane",
  removeEditorPane: "clearEditorPaneId",
  getQuote: "getQuoteText",
  setQuote: "appendToQuoteText",
  removeQuote: "clearQuoteText",
  getSuggestion: "getSuggestion",
  setSuggestion: "setSuggestion",
  removeSuggestion: "removeSuggestion",
};

function swallowErrors(logger: Logger, store: PaneStateStore): PaneStateStore {
  const wrapped = {} as Record<string, unknown>;
  for (const method of Object.keys(FAILURE_RESULTS) as StoreMethod[]) {
    const call = store[method] as (...args: string[]) => Promise<unknown>;
    wrapped[method] = async (...args: string[]) => {
      try {
        return await call(...args);
      } catch (error) {
        logger.debug(`${LEGACY_METHOD_NAMES[method]} failed: {error}`, { error });
        return FAILURE_RESULTS[method];
      }
    };
  }
  return wrapped as unknown as PaneStateStore;
}
