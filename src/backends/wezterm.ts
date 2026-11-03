import { WEZTERM_SEND_CHUNK_BYTES } from "../config/constants";
import * as wezterm from "../modules/wezterm";
import { confStore } from "./stores";
import { defineBackend } from "./types";

// WezTerm is only selected explicitly (`--mux wezterm` or EDITPROMPT_MUX),
// so it has no detect().
export const weztermBackend = defineBackend({
  name: "wezterm",
  getCurrentPaneId: () => wezterm.getCurrentPaneId(),
  paneExists: (paneId) => wezterm.checkPaneExists(paneId),
  focusPane: (paneId) => wezterm.focusPane(paneId),
  sendText: (paneId, chunk) => wezterm.sendTextChunk(paneId, chunk),
  sendKey: (paneId, key) => wezterm.sendKey(paneId, key),
  maxChunkBytes: WEZTERM_SEND_CHUNK_BYTES,
  defaultSubmitKey: "\\r",
  quoteSeparator: "\n\n",
  collectInput: "argument",
  storageNamespace: () => "wezterm",
  state: confStore(() => "wezterm"),
});
