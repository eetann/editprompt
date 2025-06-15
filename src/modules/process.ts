import { readlink } from "node:fs/promises";
import { join } from "node:path";
import find from "find-process";
import { PROCESS_NAME } from "../config/constants";

export interface ClaudeProcess {
	pid: number;
	name: string;
	cmd?: string;
	cwd?: string;
	startTime?: Date;
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
		})
	);
	
	return claudeProcesses.filter(p => p.name === PROCESS_NAME);
}

export async function sendToProcess(pid: number, content: string): Promise<void> {
	// This will be implemented to send content to the specific process
	// For now, it's a placeholder
	throw new Error("Process communication not yet implemented");
}