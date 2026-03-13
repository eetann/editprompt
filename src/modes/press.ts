import { getLogger } from "@logtape/logtape";
import { define } from "gunshi";
import { setupLogger } from "../modules/logger";
import {
  getCurrentPaneId,
  getTargetPaneIds,
  isEditorPane,
  sendKeyToTmuxPane,
} from "../modules/tmux";
import * as wezterm from "../modules/wezterm";
import { extractRawContent } from "../utils/argumentParser";
import { readSendConfig } from "../utils/sendConfig";
import { ARG_LOG_FILE, ARG_QUIET, ARG_VERBOSE } from "./args";

const logger = getLogger(["editprompt", "press"]);

export async function runPressMode(key: string, delay = 0): Promise<void> {
  if (!key) {
    logger.error("Key is required");
    process.exit(1);
  }

  const config = readSendConfig();

  let currentPaneId: string;
  let isEditor: boolean;

  if (config.mux === "tmux") {
    currentPaneId = await getCurrentPaneId();
    isEditor = await isEditorPane(currentPaneId);
  } else {
    currentPaneId = await wezterm.getCurrentPaneId();
    isEditor = wezterm.isEditorPaneFromConf(currentPaneId);
  }

  if (!isEditor) {
    logger.error("Current pane is not an editor pane");
    process.exit(1);
  }

  let targetPanes: string[];
  if (config.mux === "tmux") {
    targetPanes = await getTargetPaneIds(currentPaneId);
  } else {
    targetPanes = await wezterm.getTargetPaneIds(currentPaneId);
  }

  if (targetPanes.length === 0) {
    logger.error("No target panes registered for this editor pane");
    process.exit(1);
  }

  let successCount = 0;
  for (const targetPane of targetPanes) {
    try {
      if (config.mux === "wezterm") {
        await wezterm.sendKeyToWeztermPane(targetPane, key, delay);
      } else {
        await sendKeyToTmuxPane(targetPane, key, delay);
      }
      successCount++;
    } catch (error) {
      logger.warn(
        `Failed to send key to pane ${targetPane}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  if (successCount > 0) {
    logger.info("Key sent successfully!");
  } else {
    logger.error("All target panes failed to receive key");
    process.exit(1);
  }
}

export const pressCommand = define({
  name: "press",
  description: "Send a key to target pane without Enter",
  args: {
    delay: {
      description: "Delay before sending key (milliseconds)",
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

    const key = extractRawContent(ctx.rest, ctx.positionals);

    if (key === undefined || key === "") {
      logger.error("Key is required for press command");
      logger.error('Usage: editprompt press -- "Tab"');
      process.exit(1);
    }

    const delay = ctx.values.delay ? Number(ctx.values.delay) : 0;

    await runPressMode(key, delay);
  },
});
