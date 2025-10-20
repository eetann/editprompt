import {
  type MuxType,
  copyToClipboard,
  sendContentToPane,
} from "../modules/process";

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
