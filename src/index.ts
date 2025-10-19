#!/usr/bin/env node
import { cli } from "gunshi";
import * as pkg from "../package.json";
import { openEditorAndGetContent } from "./modules/editor";
import {
  type MuxType,
  copyToClipboard,
  isMuxType,
  sendContentToPane,
} from "./modules/process";
import type { SendConfig } from "./types/send";
import { processContent } from "./utils/contentProcessor";
import { readSendConfig } from "./utils/sendConfig";

const argv = process.argv.slice(2);

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
    },
    async run(ctx) {
      try {
        // Check if positional argument exists (send-only mode)
        const rawContent = ctx.positionals[0];

        if (rawContent !== undefined) {
          // Send-only mode
          const content = processContent(rawContent);

          if (!content) {
            console.log("No content to send. Exiting.");
            return;
          }

          const config = readSendConfig();

          if (!config.targetPane) {
            console.error(
              "Error: EDITPROMPT_TARGET_PANE environment variable is required in send-only mode",
            );
            process.exit(1);
          }

          try {
            await sendContentToPane(
              config.targetPane,
              content,
              config.mux,
              config.alwaysCopy,
            );
            console.log("Content sent successfully!");
          } catch (error) {
            console.log(
              `Failed to send to pane: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
            console.log("Falling back to clipboard...");
            await copyToClipboard(content);
            console.log("Content copied to clipboard.");
          }

          // Output content to stdout
          console.log("---");
          console.log(content);
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

        // Create SendConfig to pass to editor
        const sendConfig: SendConfig = {
          targetPane: ctx.values["target-pane"],
          mux,
          alwaysCopy: ctx.values["always-copy"] || false,
        };

        console.log("Opening editor...");
        const content = await openEditorAndGetContent(
          ctx.values.editor,
          ctx.values.env,
          sendConfig,
        );

        if (!content) {
          console.log("No content entered. Exiting.");
          return;
        }

        const targetPane = ctx.values["target-pane"];
        const alwaysCopy = ctx.values["always-copy"];

        if (targetPane) {
          try {
            console.log("Sending content to specified pane...");
            await sendContentToPane(targetPane, content, mux, alwaysCopy);
            console.log("Content sent successfully!");
          } catch (error) {
            console.log(
              `Failed to send to pane: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
            console.log("Falling back to clipboard...");
            await copyToClipboard(content);
            console.log("Content copied to clipboard.");
          }
        } else {
          try {
            await copyToClipboard(content);
            console.log("Content copied to clipboard.");
          } catch (error) {
            console.log(
              `Failed to copy to clipboard: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        }

        // Output content to stdout
        console.log("---");
        console.log(content);
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
