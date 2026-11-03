import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getLogger } from "@logtape/logtape";
import { TMUX_SEND_CHUNK_BYTES } from "../config/constants";
import { splitByByteSize } from "../utils/contentChunker";

const execAsync = promisify(exec);
const logger = getLogger(["editprompt", "tmux"]);

export async function getCurrentPaneId(): Promise<string> {
  const envPaneId = process.env.TMUX_PANE?.trim();
  if (envPaneId) {
    return envPaneId;
  }
  const { stdout } = await execAsync('tmux display-message -p "#{pane_id}"');
  return stdout.trim();
}

export async function saveEditorPaneId(targetPaneId: string, editorPaneId: string): Promise<void> {
  await execAsync(
    `tmux set-option -pt '${targetPaneId}' @editprompt_editor_pane '${editorPaneId}'`,
  );
}

export async function clearEditorPaneId(targetPaneId: string): Promise<void> {
  await execAsync(`tmux set-option -pt '${targetPaneId}' @editprompt_editor_pane ""`);
}

export async function getEditorPaneId(targetPaneId: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `tmux show -pt '${targetPaneId}' -v @editprompt_editor_pane`,
    );
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function checkPaneExists(paneId: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('tmux list-panes -a -F "#{pane_id}"');
    const paneIds = stdout.split("\n").map((id) => id.trim());
    return paneIds.includes(paneId);
  } catch {
    return false;
  }
}

export async function focusPane(paneId: string): Promise<void> {
  await execAsync(`tmux select-pane -t '${paneId}'`);
}

export async function markAsEditorPane(
  editorPaneId: string,
  targetPaneIds: string[],
): Promise<void> {
  await execAsync(`tmux set-option -pt '${editorPaneId}' @editprompt_is_editor 1`);
  const uniqueTargetPaneIds = [...new Set(targetPaneIds)];
  const targetPanesValue = uniqueTargetPaneIds.join(",");
  await execAsync(
    `tmux set-option -pt '${editorPaneId}' @editprompt_target_panes '${targetPanesValue}'`,
  );
  // Save editor pane ID to each target pane
  for (const targetPaneId of uniqueTargetPaneIds) {
    await saveEditorPaneId(targetPaneId, editorPaneId);
  }
}

export async function getTargetPaneIds(editorPaneId: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `tmux show -pt '${editorPaneId}' -v @editprompt_target_panes`,
    );
    const value = stdout.trim();
    if (value === "") {
      return [];
    }
    return value.split(",").map((id) => id.trim());
  } catch {
    return [];
  }
}

export async function isEditorPane(paneId: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`tmux show -pt '${paneId}' -v @editprompt_is_editor`);
    return stdout.trim() === "1";
  } catch {
    return false;
  }
}

export async function getQuoteVariableContent(paneId: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`tmux show -pt '${paneId}' -v @editprompt_quote`);
    return stdout;
  } catch {
    return "";
  }
}

export async function appendToQuoteVariable(paneId: string, content: string): Promise<void> {
  let newContent = "";
  const existingContent = await getQuoteVariableContent(paneId);
  if (existingContent.trim() !== "") {
    newContent = `${existingContent}\n${content}`;
  } else {
    newContent = content;
  }
  await execAsync(
    `tmux set-option -pt '${paneId}' @editprompt_quote '${newContent.replace(/'/g, "'\\''")}' `,
  );
}

export async function clearQuoteVariable(targetPaneId: string): Promise<void> {
  await execAsync(`tmux set-option -pt '${targetPaneId}' @editprompt_quote ""`);
}

export async function getPaneOption(paneId: string, name: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`tmux show -pt '${paneId}' -v ${name}`);
    return stdout;
  } catch {
    return "";
  }
}

export async function setPaneOption(paneId: string, name: string, value: string): Promise<void> {
  await execAsync(`tmux set-option -pt '${paneId}' ${name} '${value.replace(/'/g, "'\\''")}'`);
}

export async function sendKey(paneId: string, key: string): Promise<void> {
  await execAsync(`tmux send-keys -t '${paneId}' '${key}'`);
}

export async function sendKeyToTmuxPane(paneId: string, key: string, delay = 1000): Promise<void> {
  // Sleep so as not to be treated as a newline (e.g., codex)
  await new Promise((resolve) => setTimeout(resolve, delay));
  await sendKey(paneId, key);
}

// Exit copy mode if the pane is in copy mode, so that send-keys types text
// instead of driving copy mode.
export async function exitCopyMode(paneId: string): Promise<void> {
  await execAsync(
    `tmux if-shell -t '${paneId}' '[ "#{pane_in_mode}" = "1" ]' "copy-mode -q -t '${paneId}'"`,
  );
}

export async function sendTextChunk(paneId: string, chunk: string): Promise<void> {
  await execAsync(`tmux send-keys -t '${paneId}' -- '${chunk.replace(/'/g, "'\\''")}'`);
}

export async function inputToTmuxPane(paneId: string, content: string): Promise<void> {
  await exitCopyMode(paneId);

  // Split long content into chunks to stay under tmux's imsg frame limit,
  // then send each chunk in order (no focus change). The --auto-send Enter is
  // sent separately by the caller after all chunks, so it fires only once.
  const chunks = splitByByteSize(content, TMUX_SEND_CHUNK_BYTES);
  for (const chunk of chunks) {
    await sendTextChunk(paneId, chunk);
  }
  logger.debug("Content sent to tmux pane: {paneId} ({chunks} chunk(s))", {
    paneId,
    chunks: chunks.length,
  });
}
