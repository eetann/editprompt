import { getLogger } from "@logtape/logtape";
import type { MuxBackend } from "../backends/types";
import { type EditorContext, EditorContextError, resolveEditorContext } from "../core/link";

export type { MuxType } from "../utils/mux";
export {
  copyToClipboard,
  type DeliveryResult,
  focusFirstSuccessPane,
  handleContentDelivery,
} from "../core/delivery";

const logger = getLogger(["editprompt"]);

/**
 * Resolves the editor pane and its target panes for commands that run inside
 * an editor pane, exiting with an error when there are none.
 */
export async function requireEditorContext(backend: MuxBackend): Promise<EditorContext> {
  try {
    return await resolveEditorContext(backend);
  } catch (error) {
    if (error instanceof EditorContextError) {
      logger.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
