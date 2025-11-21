import { define } from "gunshi";
import {
  checkPaneExists,
  clearEditorPaneId,
  focusPane,
  getCurrentPaneId,
  getEditorPaneId,
  getTargetPaneIds,
  isEditorPane,
} from "../modules/tmux";
import * as wezterm from "../modules/wezterm";
import {
  ARG_MUX,
  ARG_TARGET_PANE_SINGLE,
  validateMux,
  validateTargetPane,
} from "./args";
import type { MuxType } from "./common";

export async function runResumeMode(
  targetPane: string,
  mux: MuxType,
): Promise<void> {
  if (mux === "wezterm") {
    const currentPaneId = await wezterm.getCurrentPaneId();
    const isEditor = wezterm.isEditorPaneFromConf(currentPaneId);

    if (isEditor) {
      console.log("isEditor");
      const originalTargetPaneIds =
        await wezterm.getTargetPaneIds(currentPaneId);
      if (originalTargetPaneIds.length === 0) {
        console.log("Not found originalTargetPaneIds");
        process.exit(1);
      }

      // Try to focus on the first available pane (retry logic)
      let focused = false;
      for (const paneId of originalTargetPaneIds) {
        const exists = await wezterm.checkPaneExists(paneId);
        if (exists) {
          await wezterm.focusPane(paneId);
          focused = true;
          break;
        }
      }

      if (!focused) {
        console.log("All target panes do not exist");
        process.exit(1);
      }

      process.exit(0);
    }
    console.log("not isEditor");

    // Focus from target pane to editor pane
    const editorPaneId = await wezterm.getEditorPaneId(targetPane);
    console.log(`wezterm editorPaneId: ${editorPaneId}`);

    if (editorPaneId === "") {
      console.log("Not found editorPaneId");
      process.exit(1);
    }

    const exists = await wezterm.checkPaneExists(editorPaneId);
    if (!exists) {
      console.log("Not exist editorPaneId");
      await wezterm.clearEditorPaneId(targetPane);
      process.exit(1);
    }

    try {
      await wezterm.focusPane(editorPaneId);
      process.exit(0);
    } catch (error) {
      console.log(`Can't focus editorPaneId: ${editorPaneId}\nerror: ${error}`);
      process.exit(1);
    }
  }

  // tmux logic
  const currentPaneId = await getCurrentPaneId();
  const isEditor = await isEditorPane(currentPaneId);

  if (isEditor) {
    // Focus back to the first available target pane
    const originalTargetPaneIds = await getTargetPaneIds(currentPaneId);
    if (originalTargetPaneIds.length === 0) {
      process.exit(1);
    }

    // Try to focus on the first available pane (retry logic)
    let focused = false;
    for (const paneId of originalTargetPaneIds) {
      const exists = await checkPaneExists(paneId);
      if (exists) {
        await focusPane(paneId);
        focused = true;
        break;
      }
    }

    if (!focused) {
      // All target panes do not exist
      process.exit(1);
    }

    process.exit(0);
  }

  // focus to editor pane from target pane
  const editorPaneId = await getEditorPaneId(targetPane);

  if (editorPaneId === "") {
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

export const resumeCommand = define({
  name: "resume",
  description: "Resume existing editor pane or focus back to target pane",
  args: {
    mux: ARG_MUX,
    "target-pane": ARG_TARGET_PANE_SINGLE,
  },
  async run(ctx) {
    const targetPane = validateTargetPane(ctx.values["target-pane"], "resume");
    const mux = validateMux(ctx.values.mux);

    await runResumeMode(targetPane, mux);
  },
});
