import { define } from "gunshi";
import {
  getCurrentPaneId,
  getTargetPaneIds,
  inputToTmuxPane,
  isEditorPane,
  sendKeyToTmuxPane,
} from "../modules/tmux";
import * as wezterm from "../modules/wezterm";
import { extractRawContent } from "../utils/argumentParser";
import { processContent } from "../utils/contentProcessor";
import { readSendConfig } from "../utils/sendConfig";
import {
  copyToClipboard,
  focusFirstSuccessPane,
  handleContentDelivery,
} from "./common";

export async function runInputMode(
  rawContent: string,
  autoSend?: boolean,
  sendKey?: string,
  sendKeyDelay?: number,
): Promise<void> {
  const content = processContent(rawContent);

  if (!content) {
    console.log("No content to send. Exiting.");
    return;
  }

  const config = readSendConfig();

  // Get current pane and check if it's an editor pane
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
    console.error("Error: Current pane is not an editor pane");
    process.exit(1);
  }

  // Get target pane IDs from pane variables or Conf
  let targetPanes: string[];
  if (config.mux === "tmux") {
    targetPanes = await getTargetPaneIds(currentPaneId);
  } else {
    targetPanes = await wezterm.getTargetPaneIds(currentPaneId);
  }

  if (targetPanes.length === 0) {
    console.error("Error: No target panes registered for this editor pane");
    process.exit(1);
  }

  // Auto-send mode
  if (autoSend) {
    const key = sendKey || (config.mux === "wezterm" ? "\\r" : "C-m");

    let successCount = 0;
    for (const targetPane of targetPanes) {
      try {
        if (config.mux === "wezterm") {
          await wezterm.inputToWeztermPane(targetPane, content);
          await wezterm.sendKeyToWeztermPane(targetPane, key, sendKeyDelay);
        } else {
          await inputToTmuxPane(targetPane, content);
          await sendKeyToTmuxPane(targetPane, key, sendKeyDelay);
        }
        successCount++;
      } catch (error) {
        console.error(
          `Failed to send to pane ${targetPane}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
    if (config.alwaysCopy) {
      await copyToClipboard(content);
      console.log("Also copied to clipboard.");
    }

    if (successCount > 0) {
      console.log("Content sent and submitted successfully!");
    } else {
      console.error("Error: All target panes failed to receive content");
      process.exit(1);
    }
    return;
  }

  // Normal mode (focus on first successful pane)
  try {
    const result = await handleContentDelivery(
      content,
      config.mux,
      targetPanes,
    );

    // Copy to clipboard if alwaysCopy is enabled
    if (config.alwaysCopy && !result.allFailed) {
      await copyToClipboard(content);
      console.log("Also copied to clipboard.");
    }

    // Focus on the first successful pane
    if (result.successCount > 0) {
      await focusFirstSuccessPane(config.mux, targetPanes, result.failedPanes);
    }

    // Exit with code 1 if all panes failed (requirement 3)
    if (result.allFailed) {
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
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
  },
  async run(ctx) {
    // Get content from positional arguments or after --
    const rawContent = extractRawContent(ctx.rest, ctx.positionals);

    if (rawContent === undefined) {
      console.error("Error: Content is required for input command");
      console.error('Usage: editprompt input "your content"');
      console.error('   or: editprompt input -- "your content"');
      process.exit(1);
    }

    // Validate --send-key requires --auto-send
    if (ctx.values["send-key"] && !ctx.values["auto-send"]) {
      console.error("Error: --send-key requires --auto-send to be enabled");
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
