import { getLogger } from "@logtape/logtape";
import { define } from "gunshi";
import { getBackend } from "../backends/registry";
import type { MuxBackend } from "../backends/types";
import { setupLogger } from "../modules/logger";
import { extractRawContent } from "../utils/argumentParser";
import { readSendConfig } from "../utils/sendConfig";
import {
  ARG_LOG_FILE,
  ARG_MUX,
  ARG_QUIET,
  ARG_TARGET_PANE_SINGLE,
  ARG_VERBOSE,
  validateMux,
} from "./args";
import { requireEditorContext } from "./common";

const logger = getLogger(["editprompt", "suggestion"]);

/** Joins the suggestions of the target panes that have one, one per line. */
export async function readSuggestions(
  backend: MuxBackend,
  targetPaneIds: string[],
): Promise<string> {
  const suggestions: string[] = [];
  for (const targetPaneId of targetPaneIds) {
    const suggestion = await backend.state.getSuggestion(targetPaneId);
    if (suggestion.trim() !== "") {
      suggestions.push(suggestion);
    }
  }
  return suggestions.join("\n");
}

async function resolveTargetPane(backend: MuxBackend, value: unknown): Promise<string> {
  if (typeof value === "string" && value !== "") {
    return value;
  }
  return backend.getCurrentPaneId();
}

async function runSet(
  backend: MuxBackend,
  targetPane: unknown,
  rest: string[],
  positionals: string[],
): Promise<void> {
  const text = extractRawContent(rest, positionals);
  if (text === undefined) {
    logger.error("Suggestion text is required");
    logger.error('Usage: editprompt suggestion set -- "<text>"');
    process.exit(1);
  }
  const targetPaneId = await resolveTargetPane(backend, targetPane);
  await backend.state.setSuggestion(targetPaneId, text);
}

async function runClear(backend: MuxBackend, targetPane: unknown): Promise<void> {
  const targetPaneId = await resolveTargetPane(backend, targetPane);
  await backend.state.removeSuggestion(targetPaneId);
}

async function runGet(): Promise<void> {
  const config = readSendConfig();
  const backend = getBackend(config.mux);
  const { targetPaneIds } = await requireEditorContext(backend, logger);
  process.stdout.write(await readSuggestions(backend, targetPaneIds));
}

function showHelp(): void {
  console.log("Usage: editprompt suggestion <subcommand> [options]");
  console.log("");
  console.log("Keep the prompt suggestion shown in a target pane");
  console.log("");
  console.log("Subcommands:");
  console.log('  set -- "<text>"   Save the suggestion of the target pane');
  console.log("  get               Output the suggestion of the target panes (editor pane)");
  console.log("  clear             Clear the suggestion of the target pane");
  console.log("");
  console.log("Options:");
  console.log("  -m, --mux <mux>           Multiplexer (set, clear)");
  console.log("  -t, --target-pane <id>    Target pane ID. Default: current pane (set, clear)");
  console.log("  -h, --help                Show this help message");
}

export const suggestionCommand = define({
  name: "suggestion",
  description: "Keep the prompt suggestion shown in a target pane",
  args: {
    mux: ARG_MUX,
    "target-pane": ARG_TARGET_PANE_SINGLE,
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
    // Skip "suggestion" itself in positionals (gunshi includes subcommand name)
    const args = ctx.positionals.slice(1);

    if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
      showHelp();
      process.exit(args.length === 0 ? 1 : 0);
    }

    const subcommand = args[0];
    try {
      switch (subcommand) {
        case "set":
          await runSet(
            getBackend(validateMux(ctx.values.mux)),
            ctx.values["target-pane"],
            ctx.rest,
            args.slice(1),
          );
          break;
        case "clear":
          await runClear(getBackend(validateMux(ctx.values.mux)), ctx.values["target-pane"]);
          break;
        case "get":
          await runGet();
          break;
        default:
          logger.error("Unknown subcommand '{subcommand}'", { subcommand });
          logger.error("");
          showHelp();
          process.exit(1);
      }
    } catch (error) {
      logger.error(`${error instanceof Error ? error.message : "Unknown error"}`);
      process.exit(1);
    }
  },
});
