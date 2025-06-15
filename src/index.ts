#!/usr/bin/env node
import { cli } from "gunshi";
import { openEditorAndGetContent } from "./modules/editor";
import {
	findClaudeProcesses,
	sendContentToProcess,
	startNewClaude,
} from "./modules/process";
import { selectProcess } from "./modules/selector";

const argv = process.argv.slice(2);

await cli(argv, {
	name: "ccsender",
	description:
		"A CLI tool that lets you write prompts for Claude Code using your favorite text editor",
	args: {
		editor: {
			short: "e",
			description: "Editor to use (overrides $EDITOR)",
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

			console.log("Searching for Claude processes...");
			const processes = await findClaudeProcesses();

			if (processes.length === 0) {
				console.log("No Claude process found. Starting new Claude session...");
				await startNewClaude(content);
				console.log("Content sent to new Claude session.");
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

				console.log("Sending content to Claude process...");
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
});
