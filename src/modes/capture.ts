import { clearQuoteVariable, getQuoteVariableContent } from "../modules/tmux";
import { clearQuoteText, getQuoteText } from "../modules/wezterm";
import { readSendConfig } from "../utils/sendConfig";

export async function runCaptureMode(): Promise<void> {
  try {
    // Get config from environment variables
    const config = readSendConfig();

    if (!config.targetPane) {
      console.error(
        "Error: EDITPROMPT_TARGET_PANE environment variable is required in capture mode",
      );
      process.exit(1);
    }

    // Get and clear quote content based on multiplexer type
    let quoteContent: string;
    if (config.mux === "tmux") {
      quoteContent = await getQuoteVariableContent(config.targetPane);
      await clearQuoteVariable(config.targetPane);
    } else {
      // wezterm
      quoteContent = await getQuoteText(config.targetPane);
      await clearQuoteText(config.targetPane);
    }

    process.stdout.write(quoteContent.replace(/\n{3,}$/, "\n\n"));
    process.exit(0);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    process.exit(1);
  }
}
