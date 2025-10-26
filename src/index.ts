#!/usr/bin/env node
import { cli } from "gunshi";
import * as pkg from "../package.json";
import { runOpenEditorMode } from "./modes/openEditor";
import { runResumeMode } from "./modes/resume";
import { runSendOnlyMode } from "./modes/sendOnly";
import { type MuxType, isMuxType } from "./modules/process";
import { extractRawContent } from "./utils/argumentParser";

const argv = process.argv.slice(2);

await cli(
  argv,
  {
    name: "editprompt",
    description:
      "A CLI tool that lets you write prompts for Claude Code using your favorite text editor",
    args: {
      resume: {
        description: "Resume existing editor pane instead of creating new one",
        type: "boolean",
      },
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
    },
    async run(ctx) {
      try {
        // Resume mode check (highest priority)
        if (ctx.values.resume) {
          if (!ctx.values["target-pane"]) {
            console.error(
              "Error: --target-pane is required when using --resume",
            );
            process.exit(1);
          }

          const mux: MuxType = (ctx.values.mux as MuxType) || "tmux";
          if (!isMuxType(mux)) {
            console.error(
              `Error: Invalid mux type '${mux}'. Supported values: tmux, wezterm`,
            );
            process.exit(1);
          }

          await runResumeMode(ctx.values["target-pane"], mux);
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
