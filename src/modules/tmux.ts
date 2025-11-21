import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function getCurrentPaneId(): Promise<string> {
  const { stdout } = await execAsync('tmux display-message -p "#{pane_id}"');
  return stdout.trim();
}

export async function saveEditorPaneId(
  targetPaneId: string,
  editorPaneId: string,
): Promise<void> {
  await execAsync(
    `tmux set-option -pt '${targetPaneId}' @editprompt_editor_pane '${editorPaneId}'`,
  );
}

export async function clearEditorPaneId(targetPaneId: string): Promise<void> {
  await execAsync(
    `tmux set-option -pt '${targetPaneId}' @editprompt_editor_pane ""`,
  );
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
  await execAsync(
    `tmux set-option -pt '${editorPaneId}' @editprompt_is_editor 1`,
  );
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

export async function getTargetPaneIds(
  editorPaneId: string,
): Promise<string[]> {
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
    const { stdout } = await execAsync(
      `tmux show -pt '${paneId}' -v @editprompt_is_editor`,
    );
    return stdout.trim() === "1";
  } catch {
    return false;
  }
}

export async function getQuoteVariableContent(paneId: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `tmux show -pt '${paneId}' -v @editprompt_quote`,
    );
    return stdout;
  } catch {
    return "";
  }
}

export async function appendToQuoteVariable(
  paneId: string,
  content: string,
): Promise<void> {
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

export async function sendKeyToTmuxPane(
  paneId: string,
  key: string,
): Promise<void> {
  // Sleep so as not to be treated as a newline (e.g., codex)
  await new Promise((resolve) => setTimeout(resolve, 100));
  await execAsync(`tmux send-keys -t '${paneId}' '${key}'`);
}

export async function inputToTmuxPane(
  paneId: string,
  content: string,
): Promise<void> {
  // Exit copy mode if the pane is in copy mode
  await execAsync(
    `tmux if-shell -t '${paneId}' '[ "#{pane_in_mode}" = "1" ]' "copy-mode -q -t '${paneId}'"`,
  );

  // Send content using send-keys command (no focus change)
  await execAsync(
    `tmux send-keys -t '${paneId}' -- '${content.replace(/'/g, "'\\''")}'`,
  );
  console.log(`Content sent to tmux pane: ${paneId}`);
}
