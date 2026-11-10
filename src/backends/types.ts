/**
 * Per-pane state that editprompt keeps for a backend: which editor pane serves
 * which target panes, and the quote buffer collected for each target pane.
 *
 * Core logic (linking, resume, quote buffering) is written once against this
 * interface. A backend only decides where the state lives, for example in
 * pane variables (tmux, niwaterm) or in editprompt's Conf storage (WezTerm,
 * Herdr, Rex, command backends).
 */
export interface PaneStateStore {
  /** The editor pane registered on a target pane, or "" when there is none. */
  getEditorPaneId(targetPaneId: string): Promise<string>;
  setEditorPaneId(targetPaneId: string, editorPaneId: string): Promise<void>;
  removeEditorPaneId(targetPaneId: string): Promise<void>;

  isEditorPane(paneId: string): Promise<boolean>;
  /** The target panes registered on an editor pane, in registration order. */
  getTargetPaneIds(editorPaneId: string): Promise<string[]>;
  /** Marks a pane as an editor pane serving the given target panes. */
  setTargetPaneIds(editorPaneId: string, targetPaneIds: string[]): Promise<void>;
  /**
   * Forgets that a pane is an editor pane. Stores whose state dies with the
   * pane (pane variables) may treat this as a no-op and set
   * `keepsEditorPaneMarks`.
   */
  removeEditorPane(editorPaneId: string): Promise<void>;
  /** True when removeEditorPane is a no-op, so unlinking need not look it up. */
  readonly keepsEditorPaneMarks?: boolean;

  getQuote(targetPaneId: string): Promise<string>;
  setQuote(targetPaneId: string, text: string): Promise<void>;
  removeQuote(targetPaneId: string): Promise<void>;
}

export interface SplitPaneOptions {
  /** Desired number of rows for the new pane. */
  rows: number;
  /** Working directory for the new pane, when the caller knows one. */
  cwd?: string;
  /** Extra environment variables for the new pane. */
  env: Record<string, string>;
}

/**
 * A terminal or terminal multiplexer that editprompt can deliver content to.
 *
 * Built-in backends and backends defined in the user's configuration file are
 * both expressed with this interface and looked up through the registry, so
 * modes never branch on a backend name.
 */
export interface MuxBackend {
  /** Name used by `--mux` and `EDITPROMPT_MUX`. */
  readonly name: string;
  /** Returns true when editprompt runs inside this backend. */
  detect?(env: NodeJS.ProcessEnv): boolean;

  // --- Transport (required) ---
  getCurrentPaneId(): Promise<string>;
  paneExists(paneId: string): Promise<boolean>;
  focusPane(paneId: string): Promise<void>;
  /** Called once before the chunks of one delivery are sent. */
  beforeSendText?(paneId: string): Promise<void>;
  /** Sends one chunk of text. Core splits content by `maxChunkBytes`. */
  sendText(paneId: string, chunk: string): Promise<void>;
  sendKey(paneId: string, key: string): Promise<void>;
  /** Largest chunk, in UTF-8 bytes, that `sendText` accepts. */
  readonly maxChunkBytes: number;

  // --- Behavior knobs ---
  /** Key sent by `input --auto-send` when `--send-key` is not given. */
  readonly defaultSubmitKey: string;
  /** Separator placed between quotes appended by `collect`. */
  readonly quoteSeparator: string;
  /** Where `collect` reads the selected text from. */
  readonly collectInput: "stdin" | "argument";
  /** Prefix of Conf keys owned by this backend (used by stash). */
  storageNamespace(): string;
  /**
   * Lets `resume --target-pane` name the editor pane itself, switching back to
   * its target pane. Needed where resume runs outside the editor pane, such as
   * Herdr's detached custom commands.
   */
  readonly resumeAcceptsEditorPane?: boolean;
  /**
   * When an editor pane exits, keep the target pane's link if a newer editor
   * pane has meanwhile been registered on it, instead of clearing it.
   */
  readonly keepNewerEditorLink?: boolean;
  /**
   * Which failures `resume` reports only through its exit status (1), with a
   * debug log, instead of letting the error surface: "all" of them, or only a
   * failure to focus the editor pane ("editorFocus"). Unset lets every error
   * surface.
   */
  readonly quietResumeErrors?: "all" | "editorFocus";
  /** Logs each step of `resume` at debug level, as WezTerm and niwaterm always have. */
  readonly traceResume?: boolean;
  /** Logs a finished delivery; when unset, core logs a generic message. */
  logContentSent?(paneId: string, chunkCount: number): void;

  // --- State ---
  readonly state: PaneStateStore;

  // --- Capabilities (optional) ---
  /** Splits a new pane next to the target pane and returns its ID. */
  splitPane?(targetPaneId: string, options: SplitPaneOptions): Promise<string>;
  /** Runs a command (argv) in a pane, replacing its shell. */
  runInPane?(paneId: string, argv: string[]): Promise<void>;
  closePane?(paneId: string): Promise<void>;
}

/** A backend that can create and manage its own editor pane (used by toggle). */
export type SplitCapableBackend = MuxBackend &
  Required<Pick<MuxBackend, "splitPane" | "runInPane" | "closePane">>;

export function canSplitPane(backend: MuxBackend): backend is SplitCapableBackend {
  return (
    typeof backend.splitPane === "function" &&
    typeof backend.runInPane === "function" &&
    typeof backend.closePane === "function"
  );
}

/** Identity helper that gives backend definitions full type checking. */
export function defineBackend<T extends MuxBackend>(backend: T): T {
  return backend;
}
