import { HERDR_SEND_CHUNK_BYTES } from "../config/constants";
import * as herdr from "../modules/herdr";
import { isHerdrEnvironment } from "./env";
import { confStore } from "./stores";
import { defineBackend } from "./types";

export const herdrBackend = defineBackend({
  name: "herdr",
  detect: (env) => isHerdrEnvironment(env),
  getCurrentPaneId: () => herdr.getCurrentPaneId(),
  paneExists: (paneId) => herdr.checkPaneExists(paneId),
  focusPane: (paneId) => herdr.focusPane(paneId),
  sendText: (paneId, chunk) => herdr.sendTextChunk(paneId, chunk),
  sendKey: (paneId, key) => herdr.sendKey(paneId, key),
  maxChunkBytes: HERDR_SEND_CHUNK_BYTES,
  defaultSubmitKey: "enter",
  quoteSeparator: "\n\n",
  collectInput: "argument",
  resumeAcceptsEditorPane: true,
  keepNewerEditorLink: true,
  // Herdr pane IDs are only unique within one session, so the state is scoped
  // to the session socket.
  storageNamespace: () => herdr.getStorageNamespace(),
  state: confStore(() => herdr.getStorageNamespace()),
  splitPane: (targetPaneId, { rows, cwd, env }) =>
    herdr.splitEditorPane(targetPaneId, rows, cwd ?? process.env.HERDR_ACTIVE_PANE_CWD, env),
  runInPane: (paneId, argv) => herdr.runCommandInPane(paneId, argv),
  closePane: (paneId) => herdr.closePane(paneId),
});
