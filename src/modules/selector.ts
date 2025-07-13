import inquirer from "inquirer";
import type { TargetProcess } from "./process";

interface ProcessChoice {
	name: string;
	value: TargetProcess;
}

function formatProcessChoice(
	proc: TargetProcess,
	index: number,
): ProcessChoice {
	const parts = [`PID: ${proc.pid}`];

	if (proc.tmuxSession) {
		parts.push(`Tmux: ${proc.tmuxSession}:${proc.tmuxWindow}.${proc.tmuxPane}`);
	}

	if (proc.cwd) {
		parts.push(`Directory: ${proc.cwd}`);
	}

	return {
		name: `${index + 1}. ${parts.join(" | ")}`,
		value: proc,
	};
}

export async function selectProcess(
	processes: TargetProcess[],
): Promise<TargetProcess> {
	if (processes.length === 0) {
		throw new Error("No processes to select from");
	}

	if (processes.length === 1) {
		return processes[0];
	}

	const choices = processes.map((proc, index) =>
		formatProcessChoice(proc, index),
	);

	const { selectedProcess } = await inquirer.prompt([
		{
			type: "list",
			name: "selectedProcess",
			message: "Select a process:",
			choices,
		},
	]);

	return selectedProcess;
}
