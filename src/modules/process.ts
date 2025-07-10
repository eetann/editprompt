import { exec } from "node:child_process";
import { readlink } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import clipboardy from "clipboardy";
import find from "find-process";
import { PROCESS_NAME } from "../config/constants";

const execAsync = promisify(exec);

export interface ClaudeProcess {
	pid: number;
	name: string;
	cmd?: string;
	cwd?: string;
	startTime?: Date;
	tmuxSession?: string;
	tmuxWindow?: string;
	tmuxPane?: string;
}

export interface TmuxPane {
	session: string;
	window: string;
	pane: string;
	pid: number;
	command: string;
}

export async function getProcessCwd(pid: number): Promise<string | undefined> {
	try {
		// Linux/WSL specific - reading from /proc/PID/cwd
		const cwdPath = join("/proc", pid.toString(), "cwd");
		const cwd = await readlink(cwdPath);
		return cwd;
	} catch (error) {
		// If /proc is not available or permission denied
		return undefined;
	}
}

export async function findClaudeProcesses(): Promise<ClaudeProcess[]> {
	const tmuxAvailable = await checkTmuxAvailable();

	// If tmux is available, prioritize tmux-based processes
	if (tmuxAvailable) {
		const tmuxProcesses = await findClaudeInTmux();
		if (tmuxProcesses.length > 0) {
			// Enhance tmux processes with cwd info
			return Promise.all(
				tmuxProcesses.map(async (proc) => {
					const cwd = await getProcessCwd(proc.pid);
					return { ...proc, cwd };
				}),
			);
		}
	}

	// Fallback to regular process search
	const processes = await find("name", PROCESS_NAME);

	const claudeProcesses: ClaudeProcess[] = await Promise.all(
		processes.map(async (proc) => {
			const cwd = await getProcessCwd(proc.pid);
			return {
				pid: proc.pid,
				name: proc.name,
				cmd: proc.cmd,
				cwd,
			};
		}),
	);

	return claudeProcesses.filter((p) => p.name === PROCESS_NAME);
}

export async function checkTmuxAvailable(): Promise<boolean> {
	try {
		await execAsync("tmux list-sessions");
		return true;
	} catch {
		return false;
	}
}

export async function getTmuxPanes(): Promise<TmuxPane[]> {
	try {
		const { stdout } = await execAsync(
			"tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index}:#{pane_pid}:#{pane_current_command}'",
		);

		return stdout
			.trim()
			.split("\n")
			.map((line) => {
				const [session, windowPane, pid, command] = line.split(":");
				const [window, pane] = windowPane.split(".");

				return {
					session,
					window,
					pane,
					pid: Number.parseInt(pid, 10),
					command,
				};
			});
	} catch {
		return [];
	}
}

export async function findClaudeInTmux(): Promise<ClaudeProcess[]> {
	// First, find all processes with matching name
	const processes = await find("name", PROCESS_NAME);
	const claudeProcesses = processes.filter((p) => p.name === PROCESS_NAME);

	if (claudeProcesses.length === 0) {
		return [];
	}

	// Get tmux panes
	const tmuxPanes = await getTmuxPanes();
	if (tmuxPanes.length === 0) {
		return [];
	}

	// Match processes with tmux panes by PID
	const matchedProcesses: ClaudeProcess[] = [];
	for (const process of claudeProcesses) {
		const matchingPane = tmuxPanes.find((pane) => pane.pid === process.ppid);
		if (matchingPane) {
			matchedProcesses.push({
				pid: process.pid,
				name: process.name,
				cmd: process.cmd,
				tmuxSession: matchingPane.session,
				tmuxWindow: matchingPane.window,
				tmuxPane: matchingPane.pane,
			});
		}
	}

	return matchedProcesses;
}

export async function sendToTmuxPane(
	session: string,
	window: string,
	pane: string,
	content: string,
): Promise<void> {
	const target = `${session}:${window}.${pane}`;
	// Send content and press Enter
	await execAsync(
		`tmux send-keys -t '${target}' '${content.replace(/'/g, "'\\''")}'`,
	);
}

export async function copyToClipboard(content: string): Promise<void> {
	await clipboardy.write(content);
}

export async function sendContentToProcess(
	process: ClaudeProcess,
	content: string,
): Promise<void> {
	try {
		// Try tmux first if process has tmux info
		if (process.tmuxSession && process.tmuxWindow && process.tmuxPane) {
			await sendToTmuxPane(
				process.tmuxSession,
				process.tmuxWindow,
				process.tmuxPane,
				content,
			);
			return;
		}
	} catch (error) {
		console.log(
			`Failed to send to process. Content copied to clipboard. Error: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
	// Final fallback: copy to clipboard
	await copyToClipboard(content);
	console.log("Copy!");
}
