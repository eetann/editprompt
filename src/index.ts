#!/usr/bin/env node
import { spawn } from "node:child_process";
import { cli } from "gunshi";
import { openEditorAndGetContent } from "./modules/editor";
import { findClaudeProcesses } from "./modules/process";
import { selectProcess } from "./modules/selector";

const argv = process.argv.slice(2);

await cli(argv, {
	name: "ccsender",
	version: "0.0.1",
	description: "A CLI tool that lets you write prompts for Claude Code using your favorite text editor",
	options: {
		editor: {
			short: "e",
			description: "Editor to use (overrides $EDITOR)",
			type: String,
		},
		help: {
			short: "h",
			description: "Show help",
			type: Boolean,
		},
		version: {
			short: "v",
			description: "Show version",
			type: Boolean,
		},
	},
	async run(ctx) {
		try {
			console.log("Opening editor...");
			const content = await openEditorAndGetContent(ctx.options.editor);
			
			if (!content) {
				console.log("No content entered. Exiting.");
				return;
			}
			
			console.log("\nSearching for Claude processes...");
			const processes = await findClaudeProcesses();
			
			if (processes.length === 0) {
				console.log("No Claude process found. Starting new Claude session...");
				const claudeProcess = spawn("claude", [], {
					stdio: ["pipe", "inherit", "inherit"],
					shell: true,
				});
				
				claudeProcess.stdin.write(content);
				claudeProcess.stdin.end();
				
				claudeProcess.on("error", (error) => {
					console.error(`Failed to start Claude: ${error.message}`);
					console.error("Make sure Claude Code is installed and available in PATH");
				});
			} else {
				const selectedProcess = await selectProcess(processes);
				console.log(`\nSelected process: PID ${selectedProcess.pid}`);
				if (selectedProcess.cwd) {
					console.log(`Working directory: ${selectedProcess.cwd}`);
				}
				console.log("\n(Standard input sending will be implemented next)");
			}
		} catch (error) {
			console.error(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
			process.exit(1);
		}
	},
});
