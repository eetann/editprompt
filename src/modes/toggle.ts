import { getLogger } from "@logtape/logtape";
import { define } from "gunshi";
import { getBackend, isBuiltinBackendName } from "../backends/registry";
import { canSplitPane, type MuxBackend } from "../backends/types";
import { switchEditorFocus } from "../core/resume";
import { setupLogger } from "../modules/logger";
import type { MuxType } from "../utils/mux";
import {
  ARG_ALWAYS_COPY,
  ARG_EDITOR,
  ARG_ENV,
  ARG_LOG_FILE,
  ARG_MUX,
  ARG_QUIET,
  ARG_TARGET_PANE_SINGLE,
  ARG_VERBOSE,
  validateMux,
  validateTargetPane,
} from "./args";

const logger = getLogger(["editprompt", "toggle"]);
const DEFAULT_EDITOR_PANE_ROWS = 12;

interface EditpromptInvocation {
  execPath: string;
  scriptPath: string;
}

export interface ToggleModeOptions {
  mux: MuxType;
  targetPane: string;
  paneRows: number;
  alwaysCopy: boolean;
  editor?: string;
  env?: string[];
  logFile?: string;
  quiet: boolean;
  verbose: boolean;
  invocation?: EditpromptInvocation;
}

export function buildOpenEditorArgv(options: ToggleModeOptions): string[] {
  const invocation = options.invocation ?? {
    execPath: process.execPath,
    scriptPath: process.argv[1],
  };
  if (!invocation.scriptPath) {
    throw new Error("Cannot determine the editprompt entrypoint");
  }

  const argv = [
    invocation.execPath,
    invocation.scriptPath,
    "open",
    "--mux",
    options.mux,
    "--target-pane",
    options.targetPane,
  ];
  if (options.editor) {
    argv.push("--editor", options.editor);
  }
  if (options.alwaysCopy) {
    argv.push("--always-copy");
  }
  for (const env of options.env ?? []) {
    argv.push("--env", env);
  }
  if (options.logFile) {
    argv.push("--log-file", options.logFile);
  }
  if (options.quiet) {
    argv.push("--quiet");
  }
  if (options.verbose) {
    argv.push("--verbose");
  }
  return argv;
}

export async function runToggleMode(
  options: ToggleModeOptions,
  backend: MuxBackend = getBackend(options.mux),
): Promise<void> {
  if (!canSplitPane(backend)) {
    // Among the built-in backends only Herdr can split panes, so they keep the
    // message they have always shown.
    throw new Error(
      isBuiltinBackendName(backend.name)
        ? "toggle currently supports only the Herdr multiplexer"
        : `toggle is not supported by the '${backend.name}' multiplexer because it cannot split panes`,
    );
  }
  if (!Number.isInteger(options.paneRows) || options.paneRows <= 0) {
    throw new Error("--pane-rows must be a positive integer");
  }

  if (await switchEditorFocus(backend, options.targetPane)) {
    return;
  }

  // The split pane starts with a fresh shell environment, so Node runtime
  // warnings would reappear in the editor pane unless this is carried over.
  const launchEnv: Record<string, string> = {};
  if (process.env.NODE_NO_WARNINGS !== undefined) {
    launchEnv.NODE_NO_WARNINGS = process.env.NODE_NO_WARNINGS;
  }

  const editorPaneId = await backend.splitPane(options.targetPane, {
    rows: options.paneRows,
    env: launchEnv,
  });
  try {
    await backend.runInPane(editorPaneId, buildOpenEditorArgv(options));
  } catch (error) {
    try {
      await backend.closePane(editorPaneId);
    } catch (closeError) {
      logger.warn("Failed to close editor pane after launch failure: {error}", {
        error: closeError,
      });
    }
    throw error;
  }
}

export const toggleCommand = define({
  name: "toggle",
  description: "Open or focus an editor pane",
  args: {
    mux: ARG_MUX,
    "target-pane": ARG_TARGET_PANE_SINGLE,
    "pane-rows": {
      description: "Desired rows for the Herdr editor pane",
      type: "number",
      default: DEFAULT_EDITOR_PANE_ROWS,
    },
    editor: ARG_EDITOR,
    "always-copy": ARG_ALWAYS_COPY,
    env: ARG_ENV,
    "log-file": ARG_LOG_FILE,
    quiet: ARG_QUIET,
    verbose: ARG_VERBOSE,
  },
  async run(ctx) {
    const logFile = ctx.values["log-file"] as string | undefined;
    const quiet = Boolean(ctx.values.quiet);
    const verbose = Boolean(ctx.values.verbose);
    setupLogger({ quiet, verbose, logFile });

    const targetPane = validateTargetPane(ctx.values["target-pane"], "toggle");
    const mux = validateMux(ctx.values.mux);
    try {
      await runToggleMode({
        mux,
        targetPane,
        paneRows: Number(ctx.values["pane-rows"]),
        alwaysCopy: Boolean(ctx.values["always-copy"]),
        editor: ctx.values.editor as string | undefined,
        env: ctx.values.env as string[] | undefined,
        logFile,
        quiet,
        verbose,
      });
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
