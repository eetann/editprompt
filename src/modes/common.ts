import { getLogger } from "@logtape/logtape";
import clipboardy from "clipboardy";

const logger = getLogger(["editprompt", "delivery"]);
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

export interface DeliveryResult {
  successCount: number;
  totalCount: number;
  allSuccess: boolean;
  allFailed: boolean;
  failedPanes: string[];
}

export async function copyToClipboard(content: string): Promise<void> {
  await clipboardy.write(content);
}

async function inputContentToPane(
  content: string,
  mux: MuxType,
  targetPaneId: string,
): Promise<void> {
  if (mux === "wezterm") {
    await inputToWeztermPane(targetPaneId, content);
  } else {
    await inputToTmuxPane(targetPaneId, content);
  }
}

export async function focusFirstSuccessPane(
  mux: MuxType,
  targetPanes: string[],
  failedPanes: string[],
): Promise<void> {
  const firstSuccessPane = targetPanes.find((p) => !failedPanes.includes(p));
  if (firstSuccessPane) {
    if (mux === "tmux") {
      await focusTmuxPane(firstSuccessPane);
    } else {
      await focusWeztermPane(firstSuccessPane);
    }
  }
}

export async function handleContentDelivery(
  content: string,
  mux: MuxType,
  targetPanes: string[],
): Promise<DeliveryResult> {
  if (!content) {
    return {
      successCount: 0,
      totalCount: 0,
      allSuccess: true,
      allFailed: false,
      failedPanes: [],
    };
  }

  // If no target panes, only copy to clipboard
  if (targetPanes.length === 0) {
    try {
      await copyToClipboard(content);
      logger.info("Content copied to clipboard.");
    } catch (error) {
      logger.warn(
        `Failed to copy to clipboard: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
    return {
      successCount: 0,
      totalCount: 0,
      allSuccess: true,
      allFailed: false,
      failedPanes: [],
    };
  }

  // Send to each target pane
  const results: { pane: string; success: boolean }[] = [];
  for (const targetPane of targetPanes) {
    try {
      await inputContentToPane(content, mux, targetPane);
      results.push({ pane: targetPane, success: true });
    } catch (error) {
      logger.warn(
        `Failed to send to pane ${targetPane}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      results.push({ pane: targetPane, success: false });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failedPanes = results.filter((r) => !r.success).map((r) => r.pane);
  const allSuccess = successCount === targetPanes.length;
  const allFailed = successCount === 0;

  // Display results
  if (allSuccess) {
    logger.info("Content sent successfully to all panes!");
  } else if (allFailed) {
    logger.error("All target panes failed to receive content.");
    logger.info("Falling back to clipboard...");
    await copyToClipboard(content);
    logger.info("Content copied to clipboard.");
  } else {
    logger.warn(
      `Content sent to ${successCount}/${targetPanes.length} panes. Failed panes: ${failedPanes.join(", ")}`,
    );
  }

  return {
    successCount,
    totalCount: targetPanes.length,
    allSuccess,
    allFailed,
    failedPanes,
  };
}
