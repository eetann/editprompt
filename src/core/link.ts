import type { MuxBackend } from "../backends/types";

/**
 * Marks a pane as an editor pane serving the target panes, and records the
 * editor pane on each target pane so that resume can find it.
 */
export async function markAsEditorPane(
  backend: MuxBackend,
  editorPaneId: string,
  targetPaneIds: string[],
): Promise<void> {
  const uniqueTargetPaneIds = [...new Set(targetPaneIds)];
  await backend.state.setTargetPaneIds(editorPaneId, uniqueTargetPaneIds);
  for (const targetPaneId of uniqueTargetPaneIds) {
    await backend.state.setEditorPaneId(targetPaneId, editorPaneId);
  }
}

export function isEditorPane(backend: MuxBackend, paneId: string): Promise<boolean> {
  return backend.state.isEditorPane(paneId);
}

export function getTargetPaneIds(backend: MuxBackend, editorPaneId: string): Promise<string[]> {
  return backend.state.getTargetPaneIds(editorPaneId);
}

export function getEditorPaneId(backend: MuxBackend, targetPaneId: string): Promise<string> {
  return backend.state.getEditorPaneId(targetPaneId);
}

/**
 * Clears the editor pane registered on a target pane.
 *
 * When `expectedEditorPaneId` is given and the target pane has meanwhile been
 * linked to a newer editor pane, the newer link is kept and only the expected
 * editor pane is forgotten. This lets an editor that exits late leave a newer
 * editor's registration alone.
 */
export async function clearEditorLink(
  backend: MuxBackend,
  targetPaneId: string,
  expectedEditorPaneId?: string,
): Promise<void> {
  if (!expectedEditorPaneId && backend.state.keepsEditorPaneMarks) {
    // Nothing to forget on the editor pane, so only clear the target's link.
    await backend.state.removeEditorPaneId(targetPaneId);
    return;
  }
  const editorPaneId = await backend.state.getEditorPaneId(targetPaneId);
  if (expectedEditorPaneId && editorPaneId !== expectedEditorPaneId) {
    await backend.state.removeEditorPane(expectedEditorPaneId);
    return;
  }

  await backend.state.removeEditorPaneId(targetPaneId);
  if (editorPaneId) {
    await backend.state.removeEditorPane(editorPaneId);
  }
}

export class EditorContextError extends Error {
  override name = "EditorContextError";
}

export interface EditorContext {
  editorPaneId: string;
  targetPaneIds: string[];
}

/**
 * Resolves the editor pane editprompt runs in and the target panes registered
 * on it. Throws EditorContextError when the current pane is not an editor pane
 * or has no target panes.
 */
export async function resolveEditorContext(backend: MuxBackend): Promise<EditorContext> {
  const editorPaneId = await backend.getCurrentPaneId();
  if (!(await backend.state.isEditorPane(editorPaneId))) {
    throw new EditorContextError("Current pane is not an editor pane");
  }

  const targetPaneIds = await backend.state.getTargetPaneIds(editorPaneId);
  if (targetPaneIds.length === 0) {
    throw new EditorContextError("No target panes registered for this editor pane");
  }

  return { editorPaneId, targetPaneIds };
}
