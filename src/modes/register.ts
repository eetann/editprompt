import { getLogger } from "@logtape/logtape";
import { define } from "gunshi";
import {
  getCurrentPaneId,
  getTargetPaneIds,
  isEditorPane,
  markAsEditorPane,
} from "../modules/tmux";
import * as wezterm from "../modules/wezterm";
import { setupLogger } from "../modules/logger";
import {
  ARG_LOG_FILE,
  ARG_MUX,
  ARG_QUIET,
  ARG_TARGET_PANE_MULTI,
  ARG_VERBOSE,
  normalizeTargetPanes,
  validateMux,
} from "./args";
import type { MuxType } from "./common";

const logger = getLogger(["editprompt", "register"]);

interface RegisterModeOptions {
  mux: MuxType;
  targetPanes: string[];
  editorPane?: string;
}

export async function runRegisterMode(
  options: RegisterModeOptions,
): Promise<void> {
  if (options.targetPanes.length === 0) {
    logger.error("--target-pane is required for register command");
    process.exit(1);
  }

  let editorPaneId: string;

  // Determine editor pane ID
  if (options.editorPane) {
    editorPaneId = options.editorPane;
  } else {
    // Use current pane as editor pane
    if (options.mux === "tmux") {
      editorPaneId = await getCurrentPaneId();
      const isEditor = await isEditorPane(editorPaneId);
      if (!isEditor) {
        logger.error(
          "Current pane is not an editor pane. Please run this command from an editor pane or specify --editor-pane.",
        );
        process.exit(1);
      }
    } else if (options.mux === "wezterm") {
      editorPaneId = await wezterm.getCurrentPaneId();
      const isEditor = wezterm.isEditorPaneFromConf(editorPaneId);
      if (!isEditor) {
        logger.error(
          "Current pane is not an editor pane. Please run this command from an editor pane or specify --editor-pane.",
        );
        process.exit(1);
      }
    } else {
      logger.error("Unsupported multiplexer");
      process.exit(1);
    }
  }

  // Register editor pane with target panes
  try {
    // Get existing target panes
    let existingPanes: string[] = [];
    if (options.mux === "tmux") {
      existingPanes = await getTargetPaneIds(editorPaneId);
    } else if (options.mux === "wezterm") {
      existingPanes = await wezterm.getTargetPaneIds(editorPaneId);
    }

    // Merge with new target panes and remove duplicates
    const mergedTargetPanes = [
      ...new Set([...existingPanes, ...options.targetPanes]),
    ];

    // Save merged target panes
    if (options.mux === "tmux") {
      await markAsEditorPane(editorPaneId, mergedTargetPanes);
    } else if (options.mux === "wezterm") {
      await wezterm.markAsEditorPane(editorPaneId, mergedTargetPanes);
    }

    logger.info(
      `Editor pane ${editorPaneId} registered with target panes: ${mergedTargetPanes.join(", ")}`,
    );
  } catch (error) {
    logger.error(
      `${error instanceof Error ? error.message : "Unknown error"}`,
    );
    process.exit(1);
  }
}

export const registerCommand = define({
  name: "register",
  description:
    "Register editor pane with target panes for resume mode and content delivery",
  args: {
    mux: ARG_MUX,
    "target-pane": ARG_TARGET_PANE_MULTI,
    "editor-pane": {
      short: "e",
      description: "Editor pane ID (defaults to current pane)",
      type: "string",
    },
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
    const mux = validateMux(ctx.values.mux);
    const targetPanes = normalizeTargetPanes(ctx.values["target-pane"]);

    await runRegisterMode({
      mux,
      targetPanes,
      editorPane: ctx.values["editor-pane"] as string | undefined,
    });
  },
});
