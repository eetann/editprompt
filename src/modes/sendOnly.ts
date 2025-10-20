import { processContent } from "../utils/contentProcessor";
import { readSendConfig } from "../utils/sendConfig";
import { handleContentDelivery } from "./common";

export async function runSendOnlyMode(rawContent: string): Promise<void> {
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
