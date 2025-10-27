import { exec } from "node:child_process";
import { promisify } from "node:util";
import Conf from "conf";

const execAsync = promisify(exec);

const conf = new Conf({ projectName: "editprompt" });

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
  targetPaneId: string,
): Promise<void> {
  try {
    conf.set(`wezterm.targetPane.pane_${targetPaneId}`, {
      editorPaneId: editorPaneId,
    });
    conf.set(`wezterm.editorPane.pane_${editorPaneId}`, {
      targetPaneId: targetPaneId,
    });
  } catch (error) {
    console.log(error);
  }
}

export async function getTargetPaneId(editorPaneId: string): Promise<string> {
  try {
    const data = conf.get(`wezterm.editorPane.pane_${editorPaneId}`);
    if (typeof data === "object" && data !== null && "targetPaneId" in data) {
      return String(data.targetPaneId);
    }
    return "";
  } catch (error) {
    console.log(error);
    return "";
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
