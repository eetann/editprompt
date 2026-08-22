import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getLogger } from "@logtape/logtape";
import { NIWATERM_SEND_CHUNK_BYTES } from "../config/constants";
import { splitByByteSize } from "../utils/contentChunker";

const execAsync = promisify(exec);
const logger = getLogger(["editprompt", "niwaterm"]);

const VAR_EDITOR_PANE = "editprompt_editor_pane";
const VAR_IS_EDITOR = "editprompt_is_editor";
const VAR_TARGET_PANES = "editprompt_target_panes";
const VAR_QUOTE = "editprompt_quote";

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

async function getTabVar(tabId: string, key: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `niwaterm tab var get -t ${quoteShellWord(tabId)} ${quoteShellWord(key)}`,
    );
    return stdout.trim();
  } catch (error) {
    logger.debug("getTabVar failed: {error}", { error });
    return "";
  }
}

async function setTabVar(tabId: string, key: string, value: string): Promise<void> {
  await execAsync(
    `niwaterm tab var set -t ${quoteShellWord(tabId)} ${quoteShellWord(key)} ${quoteShellWord(value)}`,
  );
}

export async function checkPaneExists(paneId: string): Promise<boolean> {
  try {
    await execAsync(`niwaterm tab var list -t ${quoteShellWord(paneId)}`);
    return true;
  } catch (error) {
    logger.debug("checkPaneExists failed: {error}", { error });
    return false;
  }
}

export async function focusPane(paneId: string): Promise<void> {
  await execAsync(`niwaterm tab show -t ${quoteShellWord(paneId)}`);
}

export async function saveEditorPaneId(targetPaneId: string, editorPaneId: string): Promise<void> {
  await setTabVar(targetPaneId, VAR_EDITOR_PANE, editorPaneId);
}

export async function clearEditorPaneId(targetPaneId: string): Promise<void> {
  await setTabVar(targetPaneId, VAR_EDITOR_PANE, "");
}

export async function getEditorPaneId(targetPaneId: string): Promise<string> {
  return getTabVar(targetPaneId, VAR_EDITOR_PANE);
}

export async function markAsEditorPane(
  editorPaneId: string,
  targetPaneIds: string[],
): Promise<void> {
  const uniqueTargetPaneIds = [...new Set(targetPaneIds)];
  await setTabVar(editorPaneId, VAR_IS_EDITOR, "1");
  await setTabVar(editorPaneId, VAR_TARGET_PANES, uniqueTargetPaneIds.join(","));
  // Save editor pane ID to each target pane
  for (const targetPaneId of uniqueTargetPaneIds) {
    await saveEditorPaneId(targetPaneId, editorPaneId);
  }
}

export async function getTargetPaneIds(editorPaneId: string): Promise<string[]> {
  const value = await getTabVar(editorPaneId, VAR_TARGET_PANES);
  if (value === "") {
    return [];
  }
  return value.split(",").map((id) => id.trim());
}

export async function isEditorPane(paneId: string): Promise<boolean> {
  return (await getTabVar(paneId, VAR_IS_EDITOR)) === "1";
}

export async function getQuoteVariableContent(paneId: string): Promise<string> {
  return getTabVar(paneId, VAR_QUOTE);
}

export async function appendToQuoteVariable(paneId: string, content: string): Promise<void> {
  const existingContent = await getQuoteVariableContent(paneId);
  const newContent = existingContent.trim() !== "" ? `${existingContent}\n${content}` : content;
  await setTabVar(paneId, VAR_QUOTE, newContent);
}

export async function clearQuoteVariable(paneId: string): Promise<void> {
  await setTabVar(paneId, VAR_QUOTE, "");
}

export async function sendKeyToNiwatermPane(
  paneId: string,
  key: string,
  delay = 1000,
): Promise<void> {
  // Sleep so as not to be treated as a newline (e.g., codex)
  await new Promise((resolve) => setTimeout(resolve, delay));
  await execAsync(`niwaterm tab send-keys -t ${quoteShellWord(paneId)} -- ${quoteShellWord(key)}`);
}

export async function inputToNiwatermPane(paneId: string, content: string): Promise<void> {
  // Split long content into chunks to stay under the OS command-line length
  // limit, then send each chunk in order (no focus change). The --auto-send
  // Enter is sent separately by the caller after all chunks, so it fires only
  // once.
  const chunks = splitByByteSize(content, NIWATERM_SEND_CHUNK_BYTES);
  for (const chunk of chunks) {
    await execAsync(
      `niwaterm tab send-keys -t ${quoteShellWord(paneId)} -- ${quoteShellWord(chunk)}`,
    );
  }
  logger.debug("Content sent to niwaterm pane: {paneId} ({chunks} chunk(s))", {
    paneId,
    chunks: chunks.length,
  });
}
