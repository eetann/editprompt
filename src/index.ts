#!/usr/bin/env node
import { cli } from "gunshi";
import * as pkg from "../package.json";
import { DEFAULT_PROCESS_NAME } from "./config/constants";
import { openEditorAndGetContent } from "./modules/editor";
import {
	copyToClipboard,
	findTargetProcesses,
	sendContentToPane,
} from "./modules/process";
import { selectProcess } from "./modules/selector";

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
				description: "Process name to target (default: claude)",
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
				const mux = ctx.values.mux || "tmux";
				const supportedMuxes = ["tmux", "wezterm"];
				if (!supportedMuxes.includes(mux)) {
					console.error(
						`Error: Invalid mux type '${mux}'. Supported values: ${supportedMuxes.join(", ")}`,
					);
					process.exit(1);
				}

				// Check for wezterm-specific requirements
				if (mux === "wezterm" && !ctx.values["target-pane"]) {
					console.error(
						"Error: --target-pane is required when using --mux=wezterm",
					);
					process.exit(1);
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
					console.log("Sending content to specified pane...");
					await sendContentToPane(targetPane, content, mux, alwaysCopy);
					console.log("Content sent successfully!");
				} else {
					const processName = ctx.values.process || DEFAULT_PROCESS_NAME;
					console.log(`Searching for ${processName} processes...`);
					const processes = await findTargetProcesses(processName);

					if (processes.length === 0) {
						console.log(`No ${processName} process found.`);
					} else {
						const selectedProcess = await selectProcess(processes);
						if (!selectedProcess) {
							return;
						}

						// Display selected process info
						const processInfo = [`PID ${selectedProcess.pid}`];
						if (selectedProcess.tmuxSession) {
							processInfo.push(
								`Tmux: ${selectedProcess.tmuxSession}:${selectedProcess.tmuxWindow}.${selectedProcess.tmuxPane}`,
							);
						}
						if (selectedProcess.cwd) {
							processInfo.push(`Directory: ${selectedProcess.cwd}`);
						}
						console.log(`Selected process: ${processInfo.join(" | ")}`);

						console.log(`Sending content to ${processName} process...`);
						// Use tmuxPane as pane ID
						const paneId = selectedProcess.tmuxPane;

						if (paneId) {
							await sendContentToPane(paneId, content, mux, alwaysCopy);
							console.log("Content sent successfully!");
						} else {
							// No tmux pane available, fall back to clipboard
							await copyToClipboard(content);
							console.log("No tmux pane found. Content copied to clipboard.");
						}
					}
				}
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
