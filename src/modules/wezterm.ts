import { exec } from "node:child_process";
import { promisify } from "node:util";
import Conf from "conf";

const execAsync = promisify(exec);

const projectName =
  process.env.NODE_ENV === "test" ? "editprompt-test" : "editprompt";
export const conf = new Conf({ projectName });

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
    console.log(error);
    return "";
  }
}

export async function checkPaneExists(paneId: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync("wezterm cli list --format json");
    console.log(stdout);
    const panes = JSON.parse(stdout) as WeztermPane[];
    return panes.some((pane) => String(pane.pane_id) === paneId);
  } catch (error) {
    console.log(error);
    return false;
  }
}

export async function saveEditorPaneId(
  targetPaneId: string,
  editorPaneId: string,
): Promise<void> {
  console.log(`wezterm.targetPane.pane_${targetPaneId}`);
  try {
    conf.set(`wezterm.targetPane.pane_${targetPaneId}`, {
      editorPaneId: editorPaneId,
    });
  } catch (error) {
    console.log(error);
  }
}

export async function getEditorPaneId(targetPaneId: string): Promise<string> {
  try {
    const data = conf.get(`wezterm.targetPane.pane_${targetPaneId}`);
    if (typeof data === "object" && data !== null && "editorPaneId" in data) {
      return String(data.editorPaneId);
    }
    return "";
  } catch (error) {
    console.log(error);
    return "";
  }
}

export async function clearEditorPaneId(targetPaneId: string): Promise<void> {
  try {
    const editorPaneId = await getEditorPaneId(targetPaneId);
    conf.delete(`wezterm.targetPane.pane_${targetPaneId}`);
    if (editorPaneId) {
      conf.delete(`wezterm.editorPane.pane_${editorPaneId}`);
    }
  } catch (error) {
    console.log(error);
  }
}

export async function focusPane(paneId: string): Promise<void> {
  await execAsync(`wezterm cli activate-pane --pane-id '${paneId}'`);
}

export function isEditorPaneFromEnv(): boolean {
  return process.env.EDITPROMPT_IS_EDITOR === "1";
}

export function getTargetPaneIdFromEnv(): string | undefined {
  return process.env.EDITPROMPT_TARGET_PANE;
}

export async function markAsEditorPane(
  editorPaneId: string,
  targetPaneIds: string[],
): Promise<void> {
  try {
    const uniqueTargetPaneIds = [...new Set(targetPaneIds)];
    conf.set(`wezterm.editorPane.pane_${editorPaneId}`, {
      targetPaneIds: uniqueTargetPaneIds,
    });
    // Save editor pane ID to each target pane
    for (const targetPaneId of uniqueTargetPaneIds) {
      await saveEditorPaneId(targetPaneId, editorPaneId);
    }
  } catch (error) {
    console.log(error);
  }
}

export async function getTargetPaneIds(
  editorPaneId: string,
): Promise<string[]> {
  try {
    const data = conf.get(`wezterm.editorPane.pane_${editorPaneId}`);
    if (typeof data === "object" && data !== null && "targetPaneIds" in data) {
      const targetPaneIds = data.targetPaneIds;
      if (Array.isArray(targetPaneIds)) {
        return targetPaneIds.map((id) => String(id));
      }
    }
    return [];
  } catch (error) {
    console.log(error);
    return [];
  }
}

export function isEditorPaneFromConf(paneId: string): boolean {
  try {
    return conf.has(`wezterm.editorPane.pane_${paneId}`);
  } catch (error) {
    console.log(error);
    return false;
  }
}

export async function appendToQuoteText(
  paneId: string,
  content: string,
): Promise<void> {
  try {
    const data = conf.get(`wezterm.targetPane.pane_${paneId}`);
    let newData: Record<string, unknown>;

    if (typeof data === "object" && data !== null) {
      // Existing data exists, preserve it and add/update quote_text
      const existingQuoteText =
        "quote_text" in data ? String(data.quote_text) : "";
      const newQuoteText =
        existingQuoteText.trim() !== ""
          ? `${existingQuoteText}\n\n${content}`
          : content;

      newData = {
        ...data,
        quote_text: newQuoteText,
      };
    } else {
      // No existing data, create new
      newData = { quote_text: content };
    }

    conf.set(`wezterm.targetPane.pane_${paneId}`, newData);
  } catch (error) {
    console.log(error);
  }
}

export async function getQuoteText(paneId: string): Promise<string> {
  try {
    const data = conf.get(`wezterm.targetPane.pane_${paneId}`);
    if (typeof data === "object" && data !== null && "quote_text" in data) {
      return String(data.quote_text);
    }
    return "";
  } catch (error) {
    console.log(error);
    return "";
  }
}

export async function clearQuoteText(paneId: string): Promise<void> {
  try {
    const key = `wezterm.targetPane.pane_${paneId}.quote_text`;
    if (conf.has(key)) {
      conf.delete(key);
    }
  } catch (error) {
    console.log(error);
  }
}

export async function sendKeyToWeztermPane(
  paneId: string,
  key: string,
): Promise<void> {
  // Wrap user-provided key in $'...' for bash escape sequences
  await execAsync(
    `wezterm cli send-text --no-paste --pane-id '${paneId}' $'${key}'`,
  );
}

export async function inputToWeztermPane(
  paneId: string,
  content: string,
): Promise<void> {
  // Send content using wezterm cli send-text command (no focus change)
  await execAsync(
    `wezterm cli send-text --no-paste --pane-id '${paneId}' -- '${content.replace(/'/g, "'\\''")}'`,
  );
  console.log(`Content sent to wezterm pane: ${paneId}`);
}
