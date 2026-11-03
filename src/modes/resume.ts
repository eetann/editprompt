import { getLogger } from "@logtape/logtape";
import { define } from "gunshi";
import { getBackend } from "../backends/registry";
import { EditorFocusError, switchEditorFocus } from "../core/resume";
import { setupLogger } from "../modules/logger";
import {
  ARG_LOG_FILE,
  ARG_MUX,
  ARG_QUIET,
  ARG_TARGET_PANE_SINGLE,
  ARG_VERBOSE,
  validateMux,
  validateTargetPane,
} from "./args";
import type { MuxType } from "./common";

const logger = getLogger(["editprompt", "resume"]);

// Exits 0 after switching focus between the editor pane and its target pane,
// and 1 when there is nothing to switch to, which tells the caller to open a
// new editor pane instead.
export async function runResumeMode(targetPane: string, mux: MuxType): Promise<void> {
  const backend = getBackend(mux);
  let switched: boolean;
  try {
    switched = await switchEditorFocus(backend, targetPane);
  } catch (error) {
    const quiet =
      backend.quietResumeErrors === "all" ||
      (backend.quietResumeErrors === "editorFocus" && error instanceof EditorFocusError);
    if (!quiet) {
      // Surface the backend's own error, as resume always has for this backend.
      throw error instanceof EditorFocusError ? error.cause : error;
    }
    if (error instanceof EditorFocusError) {
      logger.debug("Can't focus editorPaneId: {editorPaneId}, error: {error}", {
        editorPaneId: error.editorPaneId,
        error: error.cause,
      });
    } else {
      const label = backend.name.charAt(0).toUpperCase() + backend.name.slice(1);
      logger.debug(`${label} resume failed: {error}`, { error });
    }
    process.exit(1);
  }
  process.exit(switched ? 0 : 1);
}

export const resumeCommand = define({
  name: "resume",
  description: "Resume existing editor pane or focus back to target pane",
  args: {
    mux: ARG_MUX,
    "target-pane": ARG_TARGET_PANE_SINGLE,
    "log-file": ARG_LOG_FILE,
    quiet: ARG_QUIET,
    verbose: ARG_VERBOSE,
  },
  async run(ctx) {
    setupLogger({
      quiet: Boolean(ctx.values.quiet),
      verbose: Boolean(ctx.values.verbose),
      logFile: ctx.values["log-file"] as string | undefined,
    });
    const targetPane = validateTargetPane(ctx.values["target-pane"], "resume");
    const mux = validateMux(ctx.values.mux);

    await runResumeMode(targetPane, mux);
  },
});
