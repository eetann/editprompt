import clipboardy from "clipboardy";
import { focusPane as focusTmuxPane, inputToTmuxPane } from "../modules/tmux";
import {
  focusPane as focusWeztermPane,
  inputToWeztermPane,
} from "../modules/wezterm";

export type MuxType = "tmux" | "wezterm";

export function isMuxType(value: unknown): value is MuxType {
  return value === "tmux" || value === "wezterm";
}

export const SUPPORTED_MUXES: MuxType[] = ["tmux", "wezterm"];

export async function copyToClipboard(content: string): Promise<void> {
  await clipboardy.write(content);
}

async function inputContentToPaneWithFocus(
  content: string,
  mux: MuxType,
  targetPaneId: string,
  alwaysCopy: boolean,
): Promise<void> {
  if (mux === "wezterm") {
    await inputToWeztermPane(targetPaneId, content);
    await focusWeztermPane(targetPaneId);
  } else {
    await inputToTmuxPane(targetPaneId, content);
    await focusTmuxPane(targetPaneId);
  }

  if (alwaysCopy) {
    await copyToClipboard(content);
    console.log("Also copied to clipboard.");
  }
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
      await inputContentToPaneWithFocus(content, mux, targetPane, alwaysCopy);
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
}
