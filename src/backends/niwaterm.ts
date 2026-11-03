import { NIWATERM_SEND_CHUNK_BYTES } from "../config/constants";
import * as niwaterm from "../modules/niwaterm";
import { isNiwatermEnvironment } from "./env";
import { paneVariableStore } from "./stores";
import { defineBackend } from "./types";

export const niwatermBackend = defineBackend({
  name: "niwaterm",
  detect: (env) => isNiwatermEnvironment(env),
  getCurrentPaneId: () => niwaterm.getCurrentPaneId(),
  paneExists: (paneId) => niwaterm.checkPaneExists(paneId),
  focusPane: (paneId) => niwaterm.focusPane(paneId),
  sendText: (paneId, chunk) => niwaterm.sendTextChunk(paneId, chunk),
  sendKey: (paneId, key) => niwaterm.sendKey(paneId, key),
  maxChunkBytes: NIWATERM_SEND_CHUNK_BYTES,
  defaultSubmitKey: "C-m",
  quoteSeparator: "\n",
  collectInput: "argument",
  storageNamespace: () => "niwaterm",
  state: paneVariableStore(
    {
      get: (paneId, name) => niwaterm.getTabVar(paneId, name),
      set: (paneId, name, value) => niwaterm.setTabVar(paneId, name, value),
    },
    "editprompt_",
  ),
});
