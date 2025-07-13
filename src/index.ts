#!/usr/bin/env node
import { cli } from "gunshi";
import { DEFAULT_PROCESS_NAME } from "./config/constants";
import { openEditorAndGetContent } from "./modules/editor";
import { findTargetProcesses, sendContentToProcess } from "./modules/process";
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
		},
		async run(ctx) {
			try {
				console.log("Opening editor...");
				const content = await openEditorAndGetContent(ctx.values.editor);

				if (!content) {
					console.log("No content entered. Exiting.");
					return;
				}

				const processName = ctx.values.process || DEFAULT_PROCESS_NAME;
				console.log(`Searching for ${processName} processes...`);
				const processes = await findTargetProcesses(processName);

				if (processes.length === 0) {
					console.log(`No ${processName} process found.`);
				} else {
					const selectedProcess = await selectProcess(processes);

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
					await sendContentToProcess(selectedProcess, content);
					console.log("Content sent successfully!");
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
		// TODO: package.jsonから取得
		version: "0.0.1",
	},
);
