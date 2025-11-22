import { define } from "gunshi";
import { appendToQuoteVariable } from "../modules/tmux";
import { appendToQuoteText } from "../modules/wezterm";
import { extractRawContent } from "../utils/argumentParser";
import { processQuoteText } from "../utils/quoteProcessor";
import {
  ARG_MUX,
  ARG_TARGET_PANE_SINGLE,
  validateMux,
  validateTargetPane,
} from "./args";
import type { MuxType } from "./common";

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => {
      chunks.push(chunk);
    });
    process.stdin.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    process.stdin.on("error", (error) => {
      reject(error);
    });
  });
}

export async function runCollectMode(
  mux: MuxType,
  targetPaneId: string,
  rawContent?: string,
): Promise<void> {
  try {
    let selection: string;

    if (rawContent !== undefined) {
      // Use positional argument (wezterm)
      selection = rawContent;
    } else {
      // Read from stdin (tmux)
      selection = await readStdin();
    }

    // Process text
    const processedText = processQuoteText(selection);

    // Append to multiplexer storage
    if (mux === "tmux") {
      await appendToQuoteVariable(targetPaneId, processedText);
    } else if (mux === "wezterm") {
      await appendToQuoteText(targetPaneId, processedText);
    }
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    process.exit(1);
  }
}

export const collectCommand = define({
  name: "collect",
  description: "Collect and accumulate quoted text to pane variable",
  args: {
    mux: ARG_MUX,
    "target-pane": ARG_TARGET_PANE_SINGLE,
  },
  async run(ctx) {
    const targetPane = validateTargetPane(ctx.values["target-pane"], "collect");
    const mux = validateMux(ctx.values.mux);

    // For wezterm, content must be provided as argument
    // For tmux, content is read from stdin
    let rawContent: string | undefined;
    if (mux === "wezterm") {
      rawContent = extractRawContent(ctx.rest, ctx.positionals);
      if (rawContent === undefined) {
        console.error(
          'Error: Text content is required for collect mode with wezterm. Use: editprompt collect --mux wezterm --target-pane <id> -- "<text>"',
        );
        process.exit(1);
      }
    }

    await runCollectMode(mux, targetPane, rawContent);
  },
});
