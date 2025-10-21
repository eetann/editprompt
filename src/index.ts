#!/usr/bin/env node
import { cli } from "gunshi";
import * as pkg from "../package.json";
import { runOpenEditorMode } from "./modes/openEditor";
import { runSendOnlyMode } from "./modes/sendOnly";
import { runTmuxLaunch } from "./modes/tmuxLaunch";
import { type MuxType, isMuxType } from "./modules/process";
import { extractRawContent } from "./utils/argumentParser";

const COMBINE_OPTIONS = new Set(["--tmux-split", "--tmux-cwd", "--launch-arg"]);

function normalizeArgv(args: string[]): string[] {
  const normalized: string[] = [];

  for (let index = 0; index < args.length; index++) {
    const current = args[index];
    if (!current) {
      continue;
    }

    const eqIndex = current.indexOf("=");
    if (eqIndex !== -1) {
      const key = current.slice(0, eqIndex);
      if (COMBINE_OPTIONS.has(key)) {
        normalized.push(current);
        continue;
      }
    }

    if (COMBINE_OPTIONS.has(current)) {
      const next = args[index + 1];
      if (next !== undefined && next !== "") {
        normalized.push(`${current}=${next}`);
        index += 1;
      } else {
        normalized.push(current);
      }
      continue;
    }

    normalized.push(current);
  }

  return normalized;
}

const argv = normalizeArgv(process.argv.slice(2));

await cli(
  argv,
  {
    name: "editprompt",
    description:
      "A CLI tool that lets you write prompts for Claude Code using your favorite text editor",
    args: {
      editor: {
        short: "e",
        description: "Editor to use (overrides $EDITOR)",
        type: "string",
      },
      process: {
        short: "p",
        description:
          "Process name to target (DEPRECATED - will be removed in v0.4.0)",
        type: "string",
      },
      "target-pane": {
        short: "t",
        description: "Target pane ID to send content to",
        type: "string",
      },
      mux: {
        short: "m",
        description: "Multiplexer type (tmux or wezterm, default: tmux)",
        type: "string",
      },
      env: {
        short: "E",
        description: "Environment variables to set (e.g., KEY=VALUE)",
        type: "string",
        multiple: true,
      },
      "always-copy": {
        description:
          "Always copy content to clipboard, even if tmux pane is available",
        type: "boolean",
      },
      "tmux-launch": {
        description:
          "Reuse or create a tmux pane before launching the editor (tmux helpers)",
        type: "boolean",
      },
      "tmux-split": {
        description:
          'Arguments passed to tmux split-window in --tmux-launch mode (e.g., "-v -l 30")',
        type: "string",
      },
      "tmux-cwd": {
        description:
          "Working directory for new panes in --tmux-launch mode (tmux -c option)",
        type: "string",
      },
      "launch-arg": {
        description:
          "Additional arguments forwarded to editprompt when creating a pane in --tmux-launch mode",
        type: "string",
        multiple: true,
      },
    },
    async run(ctx) {
      try {
        if (ctx.values["tmux-launch"]) {
          await runTmuxLaunch({
            targetPane: ctx.values["target-pane"],
            splitOptions: ctx.values["tmux-split"],
            cwd: ctx.values["tmux-cwd"],
            launchArgs: ctx.values["launch-arg"],
          });
          return;
        }

        // Check if positional argument exists (send-only mode)
        const rawContent = extractRawContent(ctx.rest, ctx.positionals);

        if (rawContent !== undefined) {
          // Send-only mode
          await runSendOnlyMode(rawContent);
          return;
        }

        // Editor mode
        // Validate mux option
        const muxValue = ctx.values.mux || "tmux";
        if (!isMuxType(muxValue)) {
          console.error(
            `Error: Invalid mux type '${muxValue}'. Supported values: tmux, wezterm`,
          );
          process.exit(1);
        }
        const mux: MuxType = muxValue;

        // Check for wezterm-specific requirements
        if (mux === "wezterm" && !ctx.values["target-pane"]) {
          console.error(
            "Error: --target-pane is required when using --mux=wezterm",
          );
          process.exit(1);
        }

        // Deprecation warning for process option
        if (ctx.values.process) {
          console.warn(
            "Warning: --process option is deprecated and will be removed in future versions.",
          );
          console.warn(
            "Use --target-pane to specify the target pane directly.",
          );
        }

        await runOpenEditorMode({
          mux,
          targetPane: ctx.values["target-pane"],
          alwaysCopy: ctx.values["always-copy"] || false,
          editor: ctx.values.editor,
          env: ctx.values.env,
        });
      } catch (error) {
        console.error(
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        process.exit(1);
      }
    },
  },
  {
    version: pkg.version,
  },
);
