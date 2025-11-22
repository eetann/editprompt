import { define } from "gunshi";
import {
  clearQuoteVariable,
  getCurrentPaneId,
  getQuoteVariableContent,
  getTargetPaneIds,
  isEditorPane,
} from "../modules/tmux";
import * as wezterm from "../modules/wezterm";
import { readSendConfig } from "../utils/sendConfig";

export async function runDumpMode(): Promise<void> {
  try {
    // Get config from environment variables
    const config = readSendConfig();

    // Get current pane and check if it's an editor pane
    let currentPaneId: string;
    let isEditor: boolean;

    if (config.mux === "tmux") {
      currentPaneId = await getCurrentPaneId();
      isEditor = await isEditorPane(currentPaneId);
    } else {
      currentPaneId = await wezterm.getCurrentPaneId();
      isEditor = wezterm.isEditorPaneFromConf(currentPaneId);
    }

    if (!isEditor) {
      console.error("Error: Current pane is not an editor pane");
      process.exit(1);
    }

    // Get target pane IDs from pane variables or Conf
    let targetPanes: string[];
    if (config.mux === "tmux") {
      targetPanes = await getTargetPaneIds(currentPaneId);
    } else {
      targetPanes = await wezterm.getTargetPaneIds(currentPaneId);
    }

    if (targetPanes.length === 0) {
      console.error("Error: No target panes registered for this editor pane");
      process.exit(1);
    }

    // Get and clear quote content from all target panes
    const quoteContents: string[] = [];
    for (const targetPane of targetPanes) {
      let content: string;
      if (config.mux === "tmux") {
        content = await getQuoteVariableContent(targetPane);
        await clearQuoteVariable(targetPane);
      } else {
        content = await wezterm.getQuoteText(targetPane);
        await wezterm.clearQuoteText(targetPane);
      }
      if (content.trim() !== "") {
        quoteContents.push(content);
      }
    }

    // Join all quote contents with newline
    const combinedContent = quoteContents.join("\n");
    process.stdout.write(combinedContent.replace(/\n{3,}$/, "\n\n"));
    process.exit(0);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    process.exit(1);
  }
}

export const dumpCommand = define({
  name: "dump",
  description:
    "Output and clear collected quoted text from environment variables",
  args: {},
  async run() {
    await runDumpMode();
  },
});
