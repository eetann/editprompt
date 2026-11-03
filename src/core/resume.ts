import type { MuxBackend } from "../backends/types";
import { clearEditorLink } from "./link";

/**
 * Switches focus between an editor pane and its target panes.
 *
 * From an editor pane (the current pane, or `targetPaneId` itself when it is
 * one), focus the first registered target pane that still exists. From a
 * target pane, focus its editor pane, forgetting the link when that pane is
 * gone. Returns false when there is nothing to switch to.
 */
export async function switchEditorFocus(
  backend: MuxBackend,
  targetPaneId: string,
): Promise<boolean> {
  const currentPaneId = await backend.getCurrentPaneId();
  const editorPaneId = (await backend.state.isEditorPane(currentPaneId))
    ? currentPaneId
    : (await backend.state.isEditorPane(targetPaneId))
      ? targetPaneId
      : "";

  if (editorPaneId) {
    for (const paneId of await backend.state.getTargetPaneIds(editorPaneId)) {
      if (await backend.paneExists(paneId)) {
        await backend.focusPane(paneId);
        return true;
      }
    }
    return false;
  }

  const registeredEditorPaneId = await backend.state.getEditorPaneId(targetPaneId);
  if (registeredEditorPaneId === "") {
    return false;
  }
  if (!(await backend.paneExists(registeredEditorPaneId))) {
    await clearEditorLink(backend, targetPaneId);
    return false;
  }

  await backend.focusPane(registeredEditorPaneId);
  return true;
}
