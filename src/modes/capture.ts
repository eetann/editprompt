import clipboardy from "clipboardy";
import { clearQuoteVariable, getQuoteVariableContent } from "../modules/tmux";
import { readSendConfig } from "../utils/sendConfig";

export async function runCaptureMode(): Promise<void> {
  try {
    // Get target pane ID from environment variable
    const config = readSendConfig();

    if (!config.targetPane) {
      console.error(
        "Error: EDITPROMPT_TARGET_PANE environment variable is required in capture mode",
      );
      process.exit(1);
    }

    // Get quote variable content
    const quoteContent = await getQuoteVariableContent(config.targetPane);

    // Copy to clipboard
    await clipboardy.write(quoteContent);

    // Clear quote variable
    await clearQuoteVariable(config.targetPane);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    process.exit(1);
  }
}
