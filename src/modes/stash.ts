import { getLogger } from "@logtape/logtape";
import { define } from "gunshi";
import { conf } from "../modules/conf";
import { setupLogger } from "../modules/logger";
import { getCurrentPaneId, getTargetPaneIds, isEditorPane } from "../modules/tmux";
import * as wezterm from "../modules/wezterm";
import { extractRawContent } from "../utils/argumentParser";
import { readSendConfig } from "../utils/sendConfig";
import { ARG_LOG_FILE, ARG_QUIET, ARG_VERBOSE } from "./args";
import type { MuxType } from "./common";

const logger = getLogger(["editprompt", "stash"]);

// Stash storage key helper
function getStashKey(mux: MuxType, targetPaneId: string): string {
  return `${mux}.targetPane.pane_${targetPaneId}.stash`;
}

// Stash data type
type StashData = Record<string, string>;

export interface StashEntry {
  key: string;
  content: string;
}

// Push content to stash
export async function pushStash(
  mux: MuxType,
  targetPaneId: string,
  content: string,
): Promise<string> {
  const key = new Date().toISOString();
  const stashKey = getStashKey(mux, targetPaneId);
  const existing = (conf.get(stashKey) as StashData) || {};
  existing[key] = content;
  conf.set(stashKey, existing);
  return key;
}

// Get stash list sorted by key descending
export function getStashList(mux: MuxType, targetPaneId: string): StashEntry[] {
  const stashKey = getStashKey(mux, targetPaneId);
  const data = (conf.get(stashKey) as StashData) || {};
  const entries = Object.entries(data).map(([key, content]) => ({
    key,
    content,
  }));
  return entries.sort((a, b) => b.key.localeCompare(a.key));
}

// Get stash content by key (or latest if not specified)
export function getStashContent(mux: MuxType, targetPaneId: string, key?: string): string {
  const stashKey = getStashKey(mux, targetPaneId);
  const data = (conf.get(stashKey) as StashData) || {};

  if (key) {
    return data[key] ?? "";
  }

  // Get latest (max key)
  const keys = Object.keys(data);
  if (keys.length === 0) {
    return "";
  }
  const latestKey = keys.sort().pop() as string;
  return data[latestKey] as string;
}

// Drop stash entry by key (or latest if not specified)
export function dropStash(mux: MuxType, targetPaneId: string, key?: string): boolean {
  const stashKey = getStashKey(mux, targetPaneId);
  const data = (conf.get(stashKey) as StashData) || {};

  let targetKey = key;
  if (!targetKey) {
    // Get latest (max key)
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return false;
    }
    targetKey = keys.sort().pop() as string;
  }

  if (!(targetKey in data)) {
    return false;
  }

  delete data[targetKey];
  conf.set(stashKey, data);
  return true;
}

// Common function to get target pane for stash operations
async function getTargetPaneForStash(): Promise<{
  mux: MuxType;
  targetPaneId: string;
}> {
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
    logger.error("Current pane is not an editor pane");
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
    logger.error("No target panes registered for this editor pane");
    process.exit(1);
  }

  // Use the first target pane
  return { mux: config.mux, targetPaneId: targetPanes[0] as string };
}

// Subcommand handlers
async function runPush(rest: string[], positionals: string[]): Promise<void> {
  const rawContent = extractRawContent(rest, positionals);

  if (rawContent === undefined || rawContent.trim() === "") {
    logger.error("Content is required for stash push");
    logger.error('Usage: editprompt stash push -- "your content"');
    process.exit(1);
  }

  const { mux, targetPaneId } = await getTargetPaneForStash();
  const key = await pushStash(mux, targetPaneId, rawContent);
  logger.info`Stashed with key: ${key}`;
}

async function runList(): Promise<void> {
  const { mux, targetPaneId } = await getTargetPaneForStash();
  const entries = getStashList(mux, targetPaneId);
  console.log(JSON.stringify(entries, null, 2));
}

async function runApply(key?: string): Promise<void> {
  const { mux, targetPaneId } = await getTargetPaneForStash();
  const content = getStashContent(mux, targetPaneId, key);

  if (content === "") {
    if (key) {
      logger.error`No stash entry found with key: ${key}`;
    } else {
      logger.error("No stash entries found");
    }
    process.exit(1);
  }

  process.stdout.write(content);
}

async function runDrop(key?: string): Promise<void> {
  const { mux, targetPaneId } = await getTargetPaneForStash();
  const success = dropStash(mux, targetPaneId, key);

  if (!success) {
    if (key) {
      logger.error`No stash entry found with key: ${key}`;
    } else {
      logger.error("No stash entries found");
    }
    process.exit(1);
  }

  logger.info("Stash entry dropped");
}

async function runPop(key?: string): Promise<void> {
  const { mux, targetPaneId } = await getTargetPaneForStash();
  const content = getStashContent(mux, targetPaneId, key);

  if (content === "") {
    if (key) {
      logger.error`No stash entry found with key: ${key}`;
    } else {
      logger.error("No stash entries found");
    }
    process.exit(1);
  }

  // Output content
  process.stdout.write(content);

  // Drop the entry
  dropStash(mux, targetPaneId, key);
}

function showHelp(): void {
  console.log("Usage: editprompt stash <subcommand> [options]");
  console.log("");
  console.log("Stash prompts for later use");
  console.log("");
  console.log("Subcommands:");
  console.log('  push -- "<content>"   Push content to stash');
  console.log("  list                  List stashed entries (JSON)");
  console.log("  apply [--key <key>]   Apply (output) stashed content");
  console.log("  drop [--key <key>]    Drop stashed entry");
  console.log("  pop [--key <key>]     Apply and drop stashed entry");
  console.log("");
  console.log("Options:");
  console.log("  -k, --key <key>       Stash key (ISO datetime). Default: latest");
  console.log("  -h, --help            Show this help message");
}

function parseKeyOption(args: string[]): string | undefined {
  const keyIndex = args.findIndex((arg) => arg === "-k" || arg === "--key");
  if (keyIndex !== -1 && args[keyIndex + 1]) {
    return args[keyIndex + 1];
  }
  return undefined;
}

// Main stash command
export const stashCommand = define({
  name: "stash",
  description: "Stash prompts for later use",
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
    // Skip "stash" itself in positionals (gunshi includes subcommand name)
    const args = ctx.positionals.slice(1);

    if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
      showHelp();
      process.exit(args.length === 0 ? 1 : 0);
    }

    const subcommand = args[0];
    const subArgs = args.slice(1);

    switch (subcommand) {
      case "push":
        await runPush(ctx.rest, subArgs);
        break;
      case "list":
        await runList();
        break;
      case "apply":
        await runApply(parseKeyOption(subArgs));
        break;
      case "drop":
        await runDrop(parseKeyOption(subArgs));
        break;
      case "pop":
        await runPop(parseKeyOption(subArgs));
        break;
      default:
        logger.error`Unknown subcommand '${subcommand}'`;
        logger.error("");
        showHelp();
        process.exit(1);
    }
  },
});
