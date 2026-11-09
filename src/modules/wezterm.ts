import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["editprompt", "wezterm"]);

const execAsync = promisify(exec);

interface WeztermPane {
  pane_id: string;
  is_active: boolean;
}

export async function getCurrentPaneId(): Promise<string> {
  try {
    const { stdout } = await execAsync("wezterm cli list --format json");
    const panes = JSON.parse(stdout) as WeztermPane[];
    const activePane = panes.find((pane) => pane.is_active === true);
    return String(activePane?.pane_id);
  } catch (error) {
    logger.debug("getCurrentPaneId failed: {error}", { error });
    return "";
  }
}

export async function checkPaneExists(paneId: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync("wezterm cli list --format json");
    logger.debug("wezterm cli list output: {stdout}", { stdout });
    const panes = JSON.parse(stdout) as WeztermPane[];
    return panes.some((pane) => String(pane.pane_id) === paneId);
  } catch (error) {
    logger.debug("checkPaneExists failed: {error}", { error });
    return false;
  }
}

export async function focusPane(paneId: string): Promise<void> {
  await execAsync(`wezterm cli activate-pane --pane-id '${paneId}'`);
}

export async function sendKey(paneId: string, key: string): Promise<void> {
  // Wrap user-provided key in $'...' for bash escape sequences
  await execAsync(`wezterm cli send-text --no-paste --pane-id '${paneId}' $'${key}'`);
}

export async function sendTextChunk(paneId: string, chunk: string): Promise<void> {
  await execAsync(
    `wezterm cli send-text --no-paste --pane-id '${paneId}' -- '${chunk.replace(/'/g, "'\\''")}'`,
  );
}

export function logContentSent(paneId: string, chunkCount: number): void {
  logger.debug("Content sent to wezterm pane: {paneId} ({chunks} chunk(s))", {
    paneId,
    chunks: chunkCount,
  });
}
