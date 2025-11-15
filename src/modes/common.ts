import {
  type MuxType,
  copyToClipboard,
  sendContentToPane,
} from "../modules/process";
import { sendContentToPaneWithAutoSend } from "./sendOnly";

function outputContent(content: string): void {
  console.log("---");
  console.log(content);
}

export async function handleContentDelivery(
  content: string,
  mux: MuxType,
  targetPane: string | undefined,
  alwaysCopy: boolean,
): Promise<void> {
  if (!content) {
    return;
  }

  if (targetPane) {
    try {
      await sendContentToPane(content, mux, targetPane, alwaysCopy);
      console.log("Content sent successfully!");
    } catch (error) {
      console.log(
        `Failed to send to pane: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      console.log("Falling back to clipboard...");
      await copyToClipboard(content);
      console.log("Content copied to clipboard.");
    }
  } else {
    try {
      await copyToClipboard(content);
      console.log("Content copied to clipboard.");
    } catch (error) {
      console.log(
        `Failed to copy to clipboard: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  outputContent(content);
}

export async function handleAutoSendDelivery(
  content: string,
  mux: MuxType,
  targetPane: string,
  sendKey: string,
): Promise<void> {
  // Validation
  if (!content || !targetPane) {
    throw new Error("Content and target pane are required");
  }

  try {
    await sendContentToPaneWithAutoSend(content, mux, targetPane, sendKey);
    console.log("Content sent and submitted successfully!");
  } catch (error) {
    console.error(
      `Failed to send content: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    throw error;
  }

  // Output content for reference
  outputContent(content);
}
