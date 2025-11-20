import { define } from "gunshi";
import { openEditorAndGetContent } from "../modules/editor";
import {
  clearEditorPaneId,
  getCurrentPaneId,
  markAsEditorPane,
  saveEditorPaneId,
} from "../modules/tmux";
import * as wezterm from "../modules/wezterm";
import type { SendConfig } from "../types/send";
import {
  ARG_ALWAYS_COPY,
  ARG_EDITOR,
  ARG_MUX,
  ARG_TARGET_PANE,
  validateMux,
} from "./args";
import { type MuxType, handleContentDelivery } from "./common";

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
  } else if (options.targetPane && options.mux === "wezterm") {
    try {
      const currentPaneId = await wezterm.getCurrentPaneId();
      await wezterm.markAsEditorPane(currentPaneId, options.targetPane);
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

      // Output content for reference
      console.log("---");
      console.log(content);
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
    } else if (options.targetPane && options.mux === "wezterm") {
      try {
        await wezterm.clearEditorPaneId(options.targetPane);
      } catch {
        //
      }
    }
  }
}

export const openCommand = define({
  name: "open",
  description: "Open editor and send content to target pane",
  args: {
    mux: ARG_MUX,
    "target-pane": ARG_TARGET_PANE,
    editor: ARG_EDITOR,
    "always-copy": ARG_ALWAYS_COPY,
    env: {
      short: "E",
      description: "Environment variables to set (e.g., KEY=VALUE)",
      type: "string",
      multiple: true,
    },
  },
  async run(ctx) {
    const mux = validateMux(ctx.values.mux);

    await runOpenEditorMode({
      mux,
      targetPane: ctx.values["target-pane"] as string | undefined,
      alwaysCopy: Boolean(ctx.values["always-copy"]),
      editor: ctx.values.editor as string | undefined,
      env: ctx.values.env as string[] | undefined,
    });
  },
});
