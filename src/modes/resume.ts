import {
  checkPaneExists,
  clearEditorPaneId,
  focusPane,
  getCurrentPaneId,
  getEditorPaneId,
  getTargetPaneId,
  isEditorPane,
} from "../modules/tmux";

export async function runResumeMode(targetPane: string): Promise<void> {
  // Check if we're inside an editor pane
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

  // Normal flow: focus to editor pane from target pane
  const editorPaneId = await getEditorPaneId(targetPane);

  if (!editorPaneId) {
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
