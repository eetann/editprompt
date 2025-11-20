import { define } from "gunshi";
import { inputToTmuxPane, sendKeyToTmuxPane } from "../modules/tmux";
import { inputToWeztermPane, sendKeyToWeztermPane } from "../modules/wezterm";
import { extractRawContent } from "../utils/argumentParser";
import { processContent } from "../utils/contentProcessor";
import { readSendConfig } from "../utils/sendConfig";
import { handleContentDelivery } from "./common";

export async function runInputMode(
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
      "Error: EDITPROMPT_TARGET_PANE environment variable is required in input mode",
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
      const key = sendKey || (config.mux === "wezterm" ? "\\r" : "C-m");

      // Input content and send key (no focus change)
      if (config.mux === "wezterm") {
        await inputToWeztermPane(config.targetPane, content);
        await sendKeyToWeztermPane(config.targetPane, key);
      } else {
        await inputToTmuxPane(config.targetPane, content);
        await sendKeyToTmuxPane(config.targetPane, key);
      }

      console.log("Content sent and submitted successfully!");
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      process.exit(1);
    }
    return;
  }

  // Normal mode (with focus)
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

    await runInputMode(
      rawContent,
      Boolean(ctx.values["auto-send"]),
      ctx.values["send-key"] as string | undefined,
    );
  },
});
