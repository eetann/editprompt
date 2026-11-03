import { TMUX_SEND_CHUNK_BYTES } from "../config/constants";
import * as tmux from "../modules/tmux";
import { paneVariableStore } from "./stores";
import { defineBackend } from "./types";

// tmux is the fallback backend, so it has no detect().
export const tmuxBackend = defineBackend({
  name: "tmux",
  getCurrentPaneId: () => tmux.getCurrentPaneId(),
  paneExists: (paneId) => tmux.checkPaneExists(paneId),
  focusPane: (paneId) => tmux.focusPane(paneId),
  beforeSendText: (paneId) => tmux.exitCopyMode(paneId),
  sendText: (paneId, chunk) => tmux.sendTextChunk(paneId, chunk),
  sendKey: (paneId, key) => tmux.sendKey(paneId, key),
  maxChunkBytes: TMUX_SEND_CHUNK_BYTES,
  defaultSubmitKey: "C-m",
  quoteSeparator: "\n",
  collectInput: "stdin",
  storageNamespace: () => "tmux",
  state: paneVariableStore(
    {
      get: (paneId, name) => tmux.getPaneOption(paneId, name),
      set: (paneId, name, value) => tmux.setPaneOption(paneId, name, value),
    },
    "@editprompt_",
  ),
});
