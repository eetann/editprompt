import { REX_SEND_CHUNK_BYTES } from "../config/constants";
import * as rex from "../modules/rex";
import { isRexEnvironment } from "./env";
import { confStore } from "./stores";
import { defineBackend } from "./types";

export const rexBackend = defineBackend({
  name: "rex",
  detect: (env) => isRexEnvironment(env),
  getCurrentPaneId: () => rex.getCurrentPaneId(),
  paneExists: (paneId) => rex.checkPaneExists(paneId),
  focusPane: (paneId) => rex.focusPane(paneId),
  sendText: (paneId, chunk) => rex.sendTextChunk(paneId, chunk),
  sendKey: (paneId, key) => rex.sendKey(paneId, key),
  maxChunkBytes: REX_SEND_CHUNK_BYTES,
  defaultSubmitKey: "enter",
  quoteSeparator: "\n\n",
  collectInput: "argument",
  // Every Rex block ID is a `block:<uuid>`, unique across the server, so the
  // keys need no session namespace the way Herdr's do.
  storageNamespace: () => "rex",
  state: confStore(() => "rex"),
});
