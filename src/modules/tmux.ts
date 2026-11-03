import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function getCurrentPaneId(): Promise<string> {
  const envPaneId = process.env.TMUX_PANE?.trim();
  if (envPaneId) {
    return envPaneId;
  }
  const { stdout } = await execAsync('tmux display-message -p "#{pane_id}"');
  return stdout.trim();
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
