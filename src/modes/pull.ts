import { getLogger } from "@logtape/logtape";
import { define } from "gunshi";
import { getBackend } from "../backends/registry";
import type { MuxBackend } from "../backends/types";
import { pullFromBridge } from "../core/bridge";
import { setupLogger } from "../modules/logger";
import { readSendConfig } from "../utils/sendConfig";
import { ARG_LOG_FILE, ARG_QUIET, ARG_VERBOSE } from "./args";
import { requireEditorContext } from "./common";

const logger = getLogger(["editprompt", "pull"]);

export interface PullOutcome {
  /** The non-empty texts of the target panes, one per line. */
  text: string;
  /** False when no target pane has a bridge that answered. */
  hasBridge: boolean;
  /** Target panes whose draft was pulled but could not be cleared. */
  unclearedPaneIds: string[];
}

/** Pulls the prompt box content of each target pane through its bridge. */
export async function pullPrompts(
  backend: MuxBackend,
  targetPaneIds: string[],
  keep: boolean,
): Promise<PullOutcome> {
  const texts: string[] = [];
  const unclearedPaneIds: string[] = [];
  let hasBridge = false;
  for (const targetPaneId of targetPaneIds) {
    const socketPath = await backend.state.getBridgeSocket(targetPaneId);
    if (socketPath === "") {
      continue;
    }
    const result = await pullFromBridge(socketPath, { keep });
    if (result === undefined) {
      logger.debug("No bridge listens on {socketPath}", { socketPath });
      continue;
    }
    hasBridge = true;
    if (result.text.trim() !== "") {
      texts.push(result.text);
    }
    if (result.source === "draft" && !keep && !result.isCleared) {
      unclearedPaneIds.push(targetPaneId);
    }
  }
  return { text: texts.join("\n"), hasBridge, unclearedPaneIds };
}

export const pullCommand = define({
  name: "pull",
  description: "Output the draft (or the suggestion) in the target panes' prompt box",
  args: {
    keep: {
      description: "Leave the draft in the prompt box",
      type: "boolean",
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
    try {
      const config = readSendConfig();
      const backend = getBackend(config.mux);
      const { targetPaneIds } = await requireEditorContext(backend, logger);
      const outcome = await pullPrompts(backend, targetPaneIds, Boolean(ctx.values.keep));
      if (!outcome.hasBridge) {
        logger.error(
          "No target pane runs the editprompt bridge. Is the editprompt plugin installed in the agent?",
        );
        process.exit(1);
      }
      for (const paneId of outcome.unclearedPaneIds) {
        logger.warn("Could not clear the prompt box of pane {paneId}", { paneId });
      }
      process.stdout.write(outcome.text);
      process.exit(0);
    } catch (error) {
      logger.error(`${error instanceof Error ? error.message : "Unknown error"}`);
      process.exit(1);
    }
  },
});
