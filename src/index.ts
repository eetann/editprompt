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

				// processオプションの非推奨警告
				if (ctx.values.process) {
					console.warn(
						"Warning: --process option is deprecated and will be removed in future versions.",
					);
					console.warn(
						"Use --target-pane to specify the target pane directly.",
					);
				}

				console.log("Opening editor...");
				const content = await openEditorAndGetContent(
					ctx.values.editor,
					ctx.values.env,
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

				// 全ての場合で内容を標準出力
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
