import { exec } from "node:child_process";
import { promisify } from "node:util";
import clipboardy from "clipboardy";

const execAsync = promisify(exec);

export type MuxType = "tmux" | "wezterm";

export function isMuxType(value: unknown): value is MuxType {
  return value === "tmux" || value === "wezterm";
}
export const SUPPORTED_MUXES: MuxType[] = ["tmux", "wezterm"];

export async function sendToTmuxPane(
  paneId: string,
  content: string,
): Promise<void> {
  // Exit copy mode if the pane is in copy mode
  await execAsync(
    `tmux if-shell -t '${paneId}' '[ "#{pane_in_mode}" = "1" ]' "copy-mode -q -t '${paneId}'"`,
  );

  // Send content using send-keys command
  await execAsync(
    `tmux send-keys -t '${paneId}' -- '${content.replace(/'/g, "'\\''")}'`,
  );
  console.log(`Content sent to tmux pane: ${paneId}`);

  // focus
  await execAsync(`tmux select-pane -t '${paneId}'`);
}

export async function sendToWeztermPane(
  paneId: string,
  content: string,
): Promise<void> {
  // Send content using wezterm cli send-text command
  await execAsync(
    `wezterm cli send-text --no-paste --pane-id '${paneId}' -- '${content.replace(/'/g, "'\\''")}'`,
  );
  console.log(`Content sent to wezterm pane: ${paneId}`);
}

// When sending code blocks to codex using paste-buffer,
// content gets truncated in the middle. This function is temporarily disabled.
// Use sendToTmuxPane with send-keys instead for reliable content delivery.
// export async function sendToSpecificPane(
// 	paneId: string,
// 	content: string,
// ): Promise<void> {
// 	const tempContent = content.replace(/'/g, "'\\''");
// 	await execAsync(
// 		`printf %s '${tempContent}' | tmux load-buffer -b editprompt -`,
// 	);
// 	await execAsync(`tmux paste-buffer -d -t '${paneId}' -b editprompt`);
// }

export async function copyToClipboard(content: string): Promise<void> {
  await clipboardy.write(content);
}

export async function sendContentToPane(
  targetPaneId: string,
  content: string,
  mux: MuxType = "tmux",
  alwaysCopy?: boolean,
): Promise<void> {
  try {
    if (mux === "wezterm") {
      await sendToWeztermPane(targetPaneId, content);
    } else {
      await sendToTmuxPane(targetPaneId, content);
    }

    if (alwaysCopy) {
      await copyToClipboard(content);
      console.log("Also copied to clipboard.");
    }
  } catch (error) {
    console.log(
      `Failed to send to pane. Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    throw error;
  }
}
