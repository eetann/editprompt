import { getLogger } from "@logtape/logtape";
import { define } from "gunshi";
import { getBackend } from "../backends/registry";
import { takeQuote } from "../core/quote";
import { setupLogger } from "../modules/logger";
import { readSendConfig } from "../utils/sendConfig";
import { ARG_LOG_FILE, ARG_QUIET, ARG_VERBOSE } from "./args";
import { requireEditorContext } from "./common";

const logger = getLogger(["editprompt", "dump"]);

export async function runDumpMode(): Promise<void> {
  try {
    // Get config from environment variables
    const config = readSendConfig();
    const backend = getBackend(config.mux);
    const { targetPaneIds } = await requireEditorContext(backend, logger);

    // Get and clear quote content from all target panes
    const quoteContents: string[] = [];
    for (const targetPane of targetPaneIds) {
      const content = await takeQuote(backend, targetPane);
      if (content.trim() !== "") {
        quoteContents.push(content);
      }
    }

    // Join all quote contents with newline
    const combinedContent = quoteContents.join("\n");
    process.stdout.write(combinedContent.replace(/\n{3,}$/, "\n\n"));
    process.exit(0);
  } catch (error) {
    logger.error(`${error instanceof Error ? error.message : "Unknown error"}`);
    process.exit(1);
  }
}

export const dumpCommand = define({
  name: "dump",
  description: "Output and clear collected quoted text from environment variables",
  args: {
    "log-file": ARG_LOG_FILE,
    quiet: ARG_QUIET,
    verbose: ARG_VERBOSE,
  },
  async run(ctx) {
    setupLogger({
      quiet: Boolean(ctx.values.quiet),
      verbose: Boolean(ctx.values.verbose),
      logFile: ctx.values["log-file"] as string | undefined,
    });
    await runDumpMode();
  },
});
