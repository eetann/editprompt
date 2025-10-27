import type { MuxType } from "../modules/process";
import {
  checkPaneExists,
  clearEditorPaneId,
  focusPane,
  getCurrentPaneId,
  getEditorPaneId,
  getTargetPaneId,
  isEditorPane,
} from "../modules/tmux";
import * as wezterm from "../modules/wezterm";

export async function runResumeMode(
  targetPane: string,
  mux: MuxType,
): Promise<void> {
  if (mux === "wezterm") {
    const currentPaneId = await wezterm.getCurrentPaneId();
    const isEditor = wezterm.isEditorPaneFromConf(currentPaneId);

    if (isEditor) {
      console.log("isEditor");
      const originalTargetPaneId = await wezterm.getTargetPaneId(currentPaneId);
      if (!originalTargetPaneId) {
        console.log("Not found originalTargetPaneId");
        process.exit(1);
      }

      const exists = await wezterm.checkPaneExists(originalTargetPaneId);
      if (!exists) {
        console.log("Not exist originalTargetPaneId");
        process.exit(1);
      }

      await wezterm.focusPane(originalTargetPaneId);
      process.exit(0);
    }
    console.log("not isEditor");

    // Focus from target pane to editor pane
    const editorPaneId = await wezterm.getEditorPaneId(targetPane);
    console.log(`wezterm editorPaneId: ${editorPaneId}`);

    if (editorPaneId === "") {
      console.log("Not found editorPaneId");
      process.exit(1);
    }

    const exists = await wezterm.checkPaneExists(editorPaneId);
    if (!exists) {
      console.log("Not exist editorPaneId");
      await wezterm.clearEditorPaneId(targetPane);
      process.exit(1);
    }

    try {
      await wezterm.focusPane(editorPaneId);
      process.exit(0);
    } catch (error) {
      console.log(`Can't focus editorPaneId: ${editorPaneId}\nerror: ${error}`);
      process.exit(1);
    }
  }

  // tmux logic
  const currentPaneId = await getCurrentPaneId();
  const isEditor = await isEditorPane(currentPaneId);

  if (isEditor) {
    // Focus back to the original target pane
    const originalTargetPaneId = await getTargetPaneId(currentPaneId);
    if (!originalTargetPaneId) {
      process.exit(1);
    }

    const exists = await checkPaneExists(originalTargetPaneId);
    if (!exists) {
      process.exit(1);
    }

    await focusPane(originalTargetPaneId);
    process.exit(0);
  }

  // focus to editor pane from target pane
  const editorPaneId = await getEditorPaneId(targetPane);

  if (editorPaneId === "") {
    process.exit(1);
  }

  const exists = await checkPaneExists(editorPaneId);
  if (!exists) {
    await clearEditorPaneId(targetPane);
    process.exit(1);
  }

  await focusPane(editorPaneId);
  process.exit(0);
}
