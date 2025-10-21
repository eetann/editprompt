import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const TMUX_OPTION_PREFIX = "@editprompt_reuse::";

function createOptionName(targetPane: string): string {
  return `${TMUX_OPTION_PREFIX}${targetPane.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}
function escapeShellArg(value: string): string {
  return value.replace(/'/g, "'\\''");
}

function shellQuote(arg: string): string {
  if (arg.length === 0) {
    return "''";
  }
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

type TmuxLaunchOptions = {
  targetPane: string | undefined;
  splitOptions?: string;
  cwd?: string;
  launchArgs?: string[];
};

async function paneExists(paneId: string): Promise<boolean> {
  try {
    await execAsync(
      `tmux display-message -p -t '${escapeShellArg(paneId)}' '#{pane_id}'`,
    );
    return true;
  } catch {
    return false;
  }
}

export async function runTmuxLaunch(options: TmuxLaunchOptions): Promise<void> {
  const targetPane = options.targetPane;

  if (!targetPane) {
    console.error("Error: --target-pane is required for --tmux-launch mode");
    process.exit(1);
  }

  const optionName = createOptionName(targetPane);

  let existingPane: string | null = null;

  try {
    const { stdout } = await execAsync(`tmux show-option -gv '${optionName}'`);
    const paneId = stdout.trim();
    existingPane = paneId ? paneId : null;
  } catch {
    existingPane = null;
  }

  if (existingPane) {
    const alive = await paneExists(existingPane);
    if (alive) {
      try {
        await execAsync(
          `tmux select-pane -t '${escapeShellArg(existingPane)}'`,
        );
        return;
      } catch (error) {
        console.warn(
          `Failed to focus existing pane ${existingPane}: ${error instanceof Error ? error.message : "Unknown error"}.`,
        );
      }
    } else {
      try {
        await execAsync(`tmux set-option -gu '${optionName}'`);
      } catch {
        // ignore cleanup failures
      }
    }
  }

  const splitOptions = options.splitOptions?.trim();
  const splitSegment =
    splitOptions && splitOptions.length > 0 ? ` ${splitOptions}` : "";
  const cwdSegment = options.cwd ? ` -c '${escapeShellArg(options.cwd)}'` : "";

  const launchArgs = options.launchArgs ?? [];
  const commandParts = [
    "editprompt",
    "--target-pane",
    targetPane,
    ...launchArgs,
  ];
  const escapedCommand = commandParts.map(shellQuote).join(" ");

  const tmuxCommand = `tmux split-window -P -F '#{pane_id}'${splitSegment}${cwdSegment} 'exec ${escapedCommand}'`;

  let newPaneId: string | null = null;

  try {
    const { stdout } = await execAsync(tmuxCommand);
    const paneId = stdout.trim();
    newPaneId = paneId ? paneId : null;
  } catch (error) {
    console.error(
      `Error: Failed to create new pane - ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    process.exit(1);
  }

  if (!newPaneId) {
    console.error("Error: Failed to obtain new pane id from tmux");
    process.exit(1);
  }

  try {
    await execAsync(
      `tmux set-option -gq '${optionName}' '${escapeShellArg(newPaneId)}'`,
    );
  } catch (error) {
    console.warn(
      `Warning: Failed to register new pane ${newPaneId}: ${error instanceof Error ? error.message : "Unknown error"}.`,
    );
  }
}
