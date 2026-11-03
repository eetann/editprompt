import { getLogger } from "@logtape/logtape";
import { define } from "gunshi";
import { getBackend } from "../backends/registry";
import { clearEditorLink, markAsEditorPane } from "../core/link";
import { openEditorAndGetContent } from "../modules/editor";
import { setupLogger } from "../modules/logger";
import type { SendConfig } from "../types/send";
import {
  ARG_ALWAYS_COPY,
  ARG_EDITOR,
  ARG_ENV,
  ARG_MUX,
  ARG_LOG_FILE,
  ARG_QUIET,
  ARG_TARGET_PANE_MULTI,
  ARG_VERBOSE,
  normalizeTargetPanes,
  validateMux,
} from "./args";
import {
  type MuxType,
  copyToClipboard,
  focusFirstSuccessPane,
  handleContentDelivery,
} from "./common";

const logger = getLogger(["editprompt", "open"]);

interface OpenEditorModeOptions {
  mux: MuxType;
  targetPanes: string[];
  alwaysCopy: boolean;
  editor?: string;
  env?: string[];
}

export async function runOpenEditorMode(options: OpenEditorModeOptions): Promise<void> {
  const backend = getBackend(options.mux);
  let editorPaneId: string | undefined;

  if (options.targetPanes.length > 0) {
    try {
      const currentPaneId = await backend.getCurrentPaneId();
      await markAsEditorPane(backend, currentPaneId, options.targetPanes);
      editorPaneId = currentPaneId;
    } catch {
      //
    }
  }

  try {
    const sendConfig: SendConfig = {
      mux: options.mux,
      alwaysCopy: options.alwaysCopy,
      sendKeyDelay: Number.parseInt(process.env.EDITPROMPT_SEND_KEY_DELAY || "", 10) || 1000,
    };

    logger.info("Opening editor...");

    const content = await openEditorAndGetContent(options.editor, options.env, sendConfig);

    if (!content) {
      logger.info("No content entered. Exiting.");
      return;
    }

    try {
      const result = await handleContentDelivery(content, backend, options.targetPanes);

      // Output content for reference
      console.log("---");
      console.log(content);

      // Copy to clipboard if alwaysCopy is enabled
      if (options.alwaysCopy && !result.allFailed) {
        await copyToClipboard(content);
        logger.info("Also copied to clipboard.");
      }

      // Focus on the first successful pane
      if (options.targetPanes.length > 0 && result.successCount > 0) {
        await focusFirstSuccessPane(backend, options.targetPanes, result.failedPanes);
      }

      // Exit with code 1 if not all panes succeeded (requirement 6)
      if (!result.allSuccess) {
        process.exit(1);
      }
    } catch (error) {
      logger.error(`${error instanceof Error ? error.message : "Unknown error"}`);
      process.exit(1);
    }
  } finally {
    if (options.targetPanes.length > 0) {
      try {
        // Pass this editor's pane ID so that a newer editor registered on the
        // same target pane meanwhile keeps its link.
        for (const targetPane of options.targetPanes) {
          await clearEditorLink(backend, targetPane, editorPaneId);
        }
      } catch {
        //
      }
    }
  }
}

export const openCommand = define({
  name: "open",
  description: "Open editor and send content to target pane",
  args: {
    mux: ARG_MUX,
    "target-pane": ARG_TARGET_PANE_MULTI,
    editor: ARG_EDITOR,
    "always-copy": ARG_ALWAYS_COPY,
    "log-file": ARG_LOG_FILE,
    quiet: ARG_QUIET,
    verbose: ARG_VERBOSE,
    env: ARG_ENV,
  },
  async run(ctx) {
    setupLogger({
      quiet: Boolean(ctx.values.quiet),
      verbose: Boolean(ctx.values.verbose),
      logFile: ctx.values["log-file"] as string | undefined,
    });
    const mux = validateMux(ctx.values.mux);
    const targetPanes = normalizeTargetPanes(ctx.values["target-pane"]);

    await runOpenEditorMode({
      mux,
      targetPanes,
      alwaysCopy: Boolean(ctx.values["always-copy"]),
      editor: ctx.values.editor as string | undefined,
      env: ctx.values.env as string[] | undefined,
    });
  },
});
