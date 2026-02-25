import { getLogger } from "@logtape/logtape";
import { define } from "gunshi";
import { appendToQuoteVariable } from "../modules/tmux";
import { appendToQuoteText } from "../modules/wezterm";
import { extractRawContent } from "../utils/argumentParser";
import { processQuoteText } from "../utils/quoteProcessor";
import { setupLogger } from "../modules/logger";
import {
  ARG_MUX,
  ARG_NO_QUOTE,
  ARG_OUTPUT,
  ARG_QUIET,
  ARG_TARGET_PANE_SINGLE,
  ARG_VERBOSE,
  validateMux,
  validateTargetPane,
} from "./args";
import type { MuxType } from "./common";

const logger = getLogger(["editprompt", "collect"]);

type CollectOutput = "buffer" | "stdout";

const SUPPORTED_OUTPUTS: CollectOutput[] = ["buffer", "stdout"];

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

function normalizeCollectOutputs(value: unknown): CollectOutput[] {
  let outputs: string[] = [];

  if (Array.isArray(value)) {
    outputs = value.map((v) => String(v));
  } else if (typeof value === "string") {
    outputs = [value];
  }

  if (outputs.length === 0) {
    return ["buffer"];
  }

  const uniqueOutputs = [...new Set(outputs)];
  const invalid = uniqueOutputs.filter(
    (v) => !SUPPORTED_OUTPUTS.includes(v as CollectOutput),
  );

  if (invalid.length > 0) {
    logger.error(
      `Invalid output(s) '${invalid.join(", ")}'. Supported values: ${SUPPORTED_OUTPUTS.join(", ")}`,
    );
    process.exit(1);
  }

  return uniqueOutputs as CollectOutput[];
}

export async function runCollectMode(
  mux: MuxType,
  targetPaneId: string,
  rawContent?: string,
  outputs: CollectOutput[] = ["buffer"],
  withQuote = true,
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
    const processedText = processQuoteText(selection, { withQuote });

    for (const output of outputs) {
      if (output === "buffer") {
        if (mux === "tmux") {
          await appendToQuoteVariable(targetPaneId, processedText);
        } else if (mux === "wezterm") {
          await appendToQuoteText(targetPaneId, processedText);
        }
      } else if (output === "stdout") {
        process.stdout.write(processedText);
      }
    }
  } catch (error) {
    logger.error(
      `${error instanceof Error ? error.message : "Unknown error"}`,
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
    output: ARG_OUTPUT,
    "no-quote": ARG_NO_QUOTE,
    quiet: ARG_QUIET,
    verbose: ARG_VERBOSE,
  },
  async run(ctx) {
    setupLogger({
      quiet: Boolean(ctx.values.quiet),
      verbose: Boolean(ctx.values.verbose),
    });
    const targetPane = validateTargetPane(ctx.values["target-pane"], "collect");
    const mux = validateMux(ctx.values.mux);
    const outputs = normalizeCollectOutputs(ctx.values.output);
    const withQuote = !ctx.values["no-quote"];

    // For wezterm, content must be provided as argument
    // For tmux, content is read from stdin
    let rawContent: string | undefined;
    if (mux === "wezterm") {
      rawContent = extractRawContent(ctx.rest, ctx.positionals);
      if (rawContent === undefined) {
        logger.error(
          'Text content is required for collect mode with wezterm. Use: editprompt collect --mux wezterm --target-pane <id> -- "<text>"',
        );
        process.exit(1);
      }
    }

    await runCollectMode(mux, targetPane, rawContent, outputs, withQuote);
  },
});
