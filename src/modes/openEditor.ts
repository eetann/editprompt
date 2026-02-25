import { getLogger } from "@logtape/logtape";
import { define } from "gunshi";
import { openEditorAndGetContent } from "../modules/editor";
import { setupLogger } from "../modules/logger";
import { clearEditorPaneId, getCurrentPaneId, markAsEditorPane } from "../modules/tmux";
import * as wezterm from "../modules/wezterm";
import type { SendConfig } from "../types/send";

const logger = getLogger(["editprompt", "open"]);
import {
  ARG_ALWAYS_COPY,
  ARG_EDITOR,
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

interface OpenEditorModeOptions {
  mux: MuxType;
  targetPanes: string[];
  alwaysCopy: boolean;
  editor?: string;
  env?: string[];
}

export async function runOpenEditorMode(options: OpenEditorModeOptions): Promise<void> {
  if (options.targetPanes.length > 0 && options.mux === "tmux") {
    try {
      const currentPaneId = await getCurrentPaneId();
      await markAsEditorPane(currentPaneId, options.targetPanes);
    } catch {
      //
    }
  } else if (options.targetPanes.length > 0 && options.mux === "wezterm") {
    try {
      const currentPaneId = await wezterm.getCurrentPaneId();
      await wezterm.markAsEditorPane(currentPaneId, options.targetPanes);
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
      const result = await handleContentDelivery(content, options.mux, options.targetPanes);

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
        await focusFirstSuccessPane(options.mux, options.targetPanes, result.failedPanes);
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
    if (options.targetPanes.length > 0 && options.mux === "tmux") {
      try {
        for (const targetPane of options.targetPanes) {
          await clearEditorPaneId(targetPane);
        }
      } catch {
        //
      }
    } else if (options.targetPanes.length > 0 && options.mux === "wezterm") {
      try {
        for (const targetPane of options.targetPanes) {
          await wezterm.clearEditorPaneId(targetPane);
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
    env: {
      short: "E",
      description: "Environment variables to set (e.g., KEY=VALUE)",
      type: "string",
      multiple: true,
    },
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
