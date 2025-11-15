import type { MuxType } from "../modules/process";
import {
  sendContentToTmuxPaneNoFocus,
  sendKeyToTmuxPane,
} from "../modules/tmux";
import {
  sendContentToWeztermPaneNoFocus,
  sendKeyToWeztermPane,
} from "../modules/wezterm";
import { processContent } from "../utils/contentProcessor";
import { readSendConfig } from "../utils/sendConfig";
import { handleAutoSendDelivery, handleContentDelivery } from "./common";

export async function sendContentToPaneWithAutoSend(
  content: string,
  mux: MuxType,
  targetPaneId: string,
  sendKey: string,
): Promise<void> {
  if (mux === "wezterm") {
    await sendContentToWeztermPaneNoFocus(targetPaneId, content);
    await sendKeyToWeztermPane(targetPaneId, sendKey);
  } else {
    await sendContentToTmuxPaneNoFocus(targetPaneId, content);
    await sendKeyToTmuxPane(targetPaneId, sendKey);
  }
}

export async function runSendOnlyMode(
  rawContent: string,
  autoSend?: boolean,
  sendKey?: string,
): Promise<void> {
  const content = processContent(rawContent);

  if (!content) {
    console.log("No content to send. Exiting.");
    return;
  }

  const config = readSendConfig();

  if (!config.targetPane) {
    console.error(
      "Error: EDITPROMPT_TARGET_PANE environment variable is required in send-only mode",
    );
    process.exit(1);
  }

  // Auto-send mode
  if (autoSend) {
    // Validate multiplexer availability
    if (!config.mux) {
      console.error(
        "Error: --auto-send requires a multiplexer (tmux or wezterm)",
      );
      process.exit(1);
    }

    try {
      const key = sendKey || (config.mux === "wezterm" ? "\\r" : "Enter");
      await handleAutoSendDelivery(content, config.mux, config.targetPane, key);
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      process.exit(1);
    }
    return;
  }

  // Normal mode
  try {
    await handleContentDelivery(
      content,
      config.mux,
      config.targetPane,
      config.alwaysCopy,
    );
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    process.exit(1);
  }
}
