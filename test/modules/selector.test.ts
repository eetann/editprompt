import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { TargetProcess } from "../../src/modules/process";
import { selectProcess } from "../../src/modules/selector";

// Mock inquirer
mock.module("inquirer", () => ({
	default: {
		prompt: mock(),
	},
}));

describe("Selector Module", () => {
	beforeEach(() => {
		mock.restore();
	});

	describe("selectProcess", () => {
		test("should throw error when no processes provided", async () => {
			expect(selectProcess([])).rejects.toThrow("No processes to select from");
		});

		test("should return single process without prompting", async () => {
			const process: TargetProcess = {
				pid: 1234,
				name: "claude",
				cwd: "/home/user/project",
			};

			const result = await selectProcess([process]);
			expect(result).toBe(process);
		});

		test("should prompt user when multiple processes available", async () => {
			const processes: TargetProcess[] = [
				{
					pid: 1234,
					name: "claude",
					cwd: "/home/user/project1",
				},
				{
					pid: 5678,
					name: "claude",
					cwd: "/home/user/project2",
					tmuxSession: "main",
					tmuxWindow: "0",
					tmuxPane: "1",
				},
			];

			const selectedProcess = processes[1];
			const promptMock = mock(() => Promise.resolve({ selectedProcess }));
			mock.module("inquirer", () => ({
				default: {
					prompt: promptMock,
				},
			}));

			const result = await selectProcess(processes);
			expect(result).toBe(selectedProcess);
			expect(promptMock).toHaveBeenCalledWith([
				{
					type: "list",
					name: "selectedProcess",
					message: "Select a process:",
					choices: [
						{
							name: "1. PID: 1234 | Directory: /home/user/project1",
							value: processes[0],
						},
						{
							name: "2. PID: 5678 | Tmux: main:0.1 | Directory: /home/user/project2",
							value: processes[1],
						},
					],
				},
			]);
		});

		test("should format process choice correctly with tmux info", async () => {
			const processes: TargetProcess[] = [
				{
					pid: 1234,
					name: "claude",
					tmuxSession: "session1",
					tmuxWindow: "2",
					tmuxPane: "0",
				},
				{
					pid: 5678,
					name: "claude",
					cwd: "/home/user",
				},
			];

			const selectedProcess = processes[0];
			const promptMock = mock(() => Promise.resolve({ selectedProcess }));
			mock.module("inquirer", () => ({
				default: {
					prompt: promptMock,
				},
			}));

			const result = await selectProcess(processes);
			expect(result).toBe(selectedProcess);

			const callArgs = promptMock.mock.calls[0][0];
			expect(callArgs[0].choices[0].name).toBe(
				"1. PID: 1234 | Tmux: session1:2.0",
			);
			expect(callArgs[0].choices[1].name).toBe(
				"2. PID: 5678 | Directory: /home/user",
			);
		});

		test("should format process choice with both tmux and directory info", async () => {
			const processes: TargetProcess[] = [
				{
					pid: 1234,
					name: "claude",
					tmuxSession: "main",
					tmuxWindow: "0",
					tmuxPane: "1",
					cwd: "/home/user/project",
				},
			];

			const selectedProcess = processes[0];
			const promptMock = mock(() => Promise.resolve({ selectedProcess }));
			mock.module("inquirer", () => ({
				default: {
					prompt: promptMock,
				},
			}));

			const result = await selectProcess([processes[0], processes[0]]);
			expect(result).toBe(selectedProcess);

			const callArgs = promptMock.mock.calls[0][0];
			expect(callArgs[0].choices[0].name).toBe(
				"1. PID: 1234 | Tmux: main:0.1 | Directory: /home/user/project",
			);
		});
	});
});
