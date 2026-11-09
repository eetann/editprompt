import { getLogger } from "@logtape/logtape";
import { define } from "gunshi";
import { getBackend } from "../backends/registry";
import { sendContentToPane, sendKeyToPane } from "../core/delivery";
import { setupLogger } from "../modules/logger";
import { extractRawContent } from "../utils/argumentParser";
import { processContent } from "../utils/contentProcessor";
import { readSendConfig } from "../utils/sendConfig";
import { ARG_LOG_FILE, ARG_QUIET, ARG_VERBOSE } from "./args";
import {
  copyToClipboard,
  focusFirstSuccessPane,
  handleContentDelivery,
  requireEditorContext,
} from "./common";

const logger = getLogger(["editprompt", "input"]);

export async function runInputMode(
  rawContent: string,
  autoSend?: boolean,
  sendKey?: string,
  sendKeyDelay?: number,
): Promise<void> {
  const content = processContent(rawContent);

  if (!content) {
    logger.info("No content to send. Exiting.");
    return;
  }

  const config = readSendConfig();
  const backend = getBackend(config.mux);
  const { targetPaneIds: targetPanes } = await requireEditorContext(backend, logger);

  // Auto-send mode
  if (autoSend) {
    const key = sendKey || backend.defaultSubmitKey;

    const IMAGE_EXTENSIONS = /\.(png|webp|avif|jpe?g|gif)\b/i;
    const hasImagePath = IMAGE_EXTENSIONS.test(content);
    const delay = hasImagePath ? (sendKeyDelay ?? 1000) : 200;

    let successCount = 0;
    for (const targetPane of targetPanes) {
      try {
        await sendContentToPane(backend, targetPane, content);
        await sendKeyToPane(backend, targetPane, key, delay);
        successCount++;
      } catch (error) {
        logger.error(
          `Failed to send to pane ${targetPane}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
    if (config.alwaysCopy) {
      await copyToClipboard(content);
      logger.info("Also copied to clipboard.");
    }

    if (successCount > 0) {
      logger.info("Content sent and submitted successfully!");
    } else {
      logger.error("All target panes failed to receive content");
      process.exit(1);
    }
    return;
  }

  // Normal mode (focus on first successful pane)
  try {
    const result = await handleContentDelivery(content, backend, targetPanes);

    // Copy to clipboard if alwaysCopy is enabled
    if (config.alwaysCopy && !result.allFailed) {
      await copyToClipboard(content);
      logger.info("Also copied to clipboard.");
    }

    // Focus on the first successful pane
    if (result.successCount > 0) {
      await focusFirstSuccessPane(backend, targetPanes, result.failedPanes);
    }

    // Exit with code 1 if all panes failed (requirement 3)
    if (result.allFailed) {
      process.exit(1);
    }
  } catch (error) {
    logger.error(`${error instanceof Error ? error.message : "Unknown error"}`);
    process.exit(1);
  }
}

export const inputCommand = define({
  name: "input",
  description: "Send content directly to target pane without opening editor",
  args: {
    "auto-send": {
      description: "Automatically send Enter key after content",
      type: "boolean",
    },
    "send-key": {
      description: "Key to send after content (requires --auto-send)",
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
    // Get content from positional arguments or after --
    const rawContent = extractRawContent(ctx.rest, ctx.positionals);

    if (rawContent === undefined) {
      logger.error("Content is required for input command");
      logger.error('Usage: editprompt input "your content"');
      logger.error('   or: editprompt input -- "your content"');
      process.exit(1);
    }

    // Validate --send-key requires --auto-send
    if (ctx.values["send-key"] && !ctx.values["auto-send"]) {
      logger.error("--send-key requires --auto-send to be enabled");
      process.exit(1);
    }

    const config = readSendConfig();

    await runInputMode(
      rawContent,
      Boolean(ctx.values["auto-send"]),
      ctx.values["send-key"] as string | undefined,
      config.sendKeyDelay,
    );
  },
});
