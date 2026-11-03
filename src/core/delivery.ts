import { getLogger } from "@logtape/logtape";
import clipboardy from "clipboardy";
import type { MuxBackend } from "../backends/types";
import { splitByByteSize } from "../utils/contentChunker";

const logger = getLogger(["editprompt", "delivery"]);

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

/**
 * Types content into a pane without changing focus. Long content is split
 * into chunks the backend accepts and sent in order.
 */
export async function sendContentToPane(
  backend: MuxBackend,
  paneId: string,
  content: string,
): Promise<void> {
  await backend.beforeSendText?.(paneId);
  const chunks = splitByByteSize(content, backend.maxChunkBytes);
  for (const chunk of chunks) {
    await backend.sendText(paneId, chunk);
  }
  logger.debug("Content sent to {backend} pane: {paneId} ({chunks} chunk(s))", {
    backend: backend.name,
    paneId,
    chunks: chunks.length,
  });
}

/**
 * Sends a key after a delay. The delay keeps some CLIs (e.g., codex) from
 * treating the key as part of a paste.
 */
export async function sendKeyToPane(
  backend: MuxBackend,
  paneId: string,
  key: string,
  delay = 1000,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delay));
  await backend.sendKey(paneId, key);
}

export async function focusFirstSuccessPane(
  backend: MuxBackend,
  targetPanes: string[],
  failedPanes: string[],
): Promise<void> {
  const firstSuccessPane = targetPanes.find((p) => !failedPanes.includes(p));
  if (firstSuccessPane) {
    await backend.focusPane(firstSuccessPane);
  }
}

export async function handleContentDelivery(
  content: string,
  backend: MuxBackend,
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
      await sendContentToPane(backend, targetPane, content);
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
