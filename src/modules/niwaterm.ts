import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getLogger } from "@logtape/logtape";

const execAsync = promisify(exec);
const logger = getLogger(["editprompt", "niwaterm"]);

function quoteShellWord(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export async function getCurrentPaneId(): Promise<string> {
  const tabId = process.env.NIWATERM_TAB_ID?.trim();
  if (!tabId) {
    throw new Error("NIWATERM_TAB_ID is not set");
  }
  return tabId;
}

export async function getTabVar(tabId: string, key: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `niwa tab var get -t ${quoteShellWord(tabId)} ${quoteShellWord(key)}`,
    );
    return stdout.trim();
  } catch (error) {
    logger.debug("getTabVar failed: {error}", { error });
    return "";
  }
}

export async function setTabVar(tabId: string, key: string, value: string): Promise<void> {
  await execAsync(
    `niwa tab var set -t ${quoteShellWord(tabId)} ${quoteShellWord(key)} ${quoteShellWord(value)}`,
  );
}

export async function checkPaneExists(paneId: string): Promise<boolean> {
  try {
    await execAsync(`niwa tab var list -t ${quoteShellWord(paneId)}`);
    return true;
  } catch (error) {
    logger.debug("checkPaneExists failed: {error}", { error });
    return false;
  }
}

export async function focusPane(paneId: string): Promise<void> {
  await execAsync(`niwa tab focus -t ${quoteShellWord(paneId)}`);
}

export async function sendKey(paneId: string, key: string): Promise<void> {
  await execAsync(`niwa tab send-keys -t ${quoteShellWord(paneId)} ${quoteShellWord(key)}`);
}

export async function sendTextChunk(paneId: string, chunk: string): Promise<void> {
  await execAsync(`niwa tab send-keys -t ${quoteShellWord(paneId)} ${quoteShellWord(chunk)}`);
}

export function logContentSent(paneId: string, chunkCount: number): void {
  logger.debug("Content sent to niwaterm pane: {paneId} ({chunks} chunk(s))", {
    paneId,
    chunks: chunkCount,
  });
}
