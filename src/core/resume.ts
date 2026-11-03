import type { MuxBackend } from "../backends/types";
import { clearEditorLink } from "./link";

/** Raised when focusing the editor pane from its target pane fails. */
export class EditorFocusError extends Error {
  override name = "EditorFocusError";

  constructor(
    readonly editorPaneId: string,
    override readonly cause: unknown,
  ) {
    super(
      `Can't focus editor pane ${editorPaneId}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

/**
 * Switches focus between an editor pane and its target panes.
 *
 * From an editor pane (the current pane, or `targetPaneId` itself when it is
 * one and the backend allows it), focus the first registered target pane that
 * still exists. From a
 * target pane, focus its editor pane, forgetting the link when that pane is
 * gone. Returns false when there is nothing to switch to.
 */
export type ResumeTrace = (message: string, properties?: Record<string, unknown>) => void;

export async function switchEditorFocus(
  backend: MuxBackend,
  targetPaneId: string,
  trace: ResumeTrace = () => {},
): Promise<boolean> {
  const currentPaneId = await backend.getCurrentPaneId();
  const editorPaneId = (await backend.state.isEditorPane(currentPaneId))
    ? currentPaneId
    : backend.resumeAcceptsEditorPane && (await backend.state.isEditorPane(targetPaneId))
      ? targetPaneId
      : "";

  if (editorPaneId) {
    trace("Current pane is an editor pane");
    const targetPaneIds = await backend.state.getTargetPaneIds(editorPaneId);
    if (targetPaneIds.length === 0) {
      trace("No target pane IDs found for editor pane");
      return false;
    }
    for (const paneId of targetPaneIds) {
      if (await backend.paneExists(paneId)) {
        await backend.focusPane(paneId);
        return true;
      }
    }
    trace("All target panes do not exist");
    return false;
  }
  trace("Current pane is not an editor pane");

  const registeredEditorPaneId = await backend.state.getEditorPaneId(targetPaneId);
  trace(`${backend.name} editorPaneId: {editorPaneId}`, { editorPaneId: registeredEditorPaneId });
  if (registeredEditorPaneId === "") {
    trace("Editor pane ID not found");
    return false;
  }
  if (!(await backend.paneExists(registeredEditorPaneId))) {
    trace("Editor pane does not exist");
    await clearEditorLink(backend, targetPaneId);
    return false;
  }

  try {
    await backend.focusPane(registeredEditorPaneId);
  } catch (error) {
    throw new EditorFocusError(registeredEditorPaneId, error);
  }
  return true;
}
