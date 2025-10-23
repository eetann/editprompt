import { openEditorAndGetContent } from "../modules/editor";
import type { MuxType } from "../modules/process";
import {
  clearEditorPaneId,
  getCurrentPaneId,
  markAsEditorPane,
  saveEditorPaneId,
} from "../modules/tmux";
import type { SendConfig } from "../types/send";
import { handleContentDelivery } from "./common";

interface OpenEditorModeOptions {
  mux: MuxType;
  targetPane?: string;
  alwaysCopy: boolean;
  editor?: string;
  env?: string[];
}

export async function runOpenEditorMode(
  options: OpenEditorModeOptions,
): Promise<void> {
  if (options.targetPane && options.mux === "tmux") {
    try {
      const currentPaneId = await getCurrentPaneId();
      await saveEditorPaneId(options.targetPane, currentPaneId);
      await markAsEditorPane(currentPaneId, options.targetPane);
    } catch {
      //
    }
  }

  try {
    const sendConfig: SendConfig = {
      targetPane: options.targetPane,
      mux: options.mux,
      alwaysCopy: options.alwaysCopy,
    };

    console.log("Opening editor...");

    const content = await openEditorAndGetContent(
      options.editor,
      options.env,
      sendConfig,
    );

    if (!content) {
      console.log("No content entered. Exiting.");
      return;
    }

    try {
      await handleContentDelivery(
        content,
        options.mux,
        options.targetPane,
        options.alwaysCopy,
      );
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      process.exit(1);
    }
  } finally {
    if (options.targetPane && options.mux === "tmux") {
      try {
        await clearEditorPaneId(options.targetPane);
      } catch {
        //
      }
    }
  }
}
