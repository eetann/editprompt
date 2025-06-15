import { describe, test, expect, mock, beforeEach } from "bun:test";
import { 
	getProcessCwd,
	findClaudeProcesses,
	checkTmuxAvailable,
	getTmuxPanes,
	findClaudeInTmux,
	sendToTmuxPane,
	startNewClaude,
	copyToClipboard,
	sendContentToProcess,
} from "../../src/modules/process";
import type { ClaudeProcess } from "../../src/modules/process";

// Mock external dependencies
mock.module("node:fs/promises", () => ({
	readlink: mock(),
}));

mock.module("node:util", () => ({
	promisify: mock((fn) => fn),
}));

mock.module("node:child_process", () => ({
	exec: mock(),
}));

mock.module("find-process", () => ({
	default: mock(),
}));

mock.module("clipboardy", () => ({
	default: {
		write: mock(),
	},
}));

describe("Process Module", () => {
	beforeEach(() => {
		mock.restore();
	});

	describe("getProcessCwd", () => {
		test("should return cwd path for valid pid", async () => {
			const readlinkMock = mock(() => Promise.resolve("/home/user/project"));
			mock.module("node:fs/promises", () => ({
				readlink: readlinkMock,
			}));

			const result = await getProcessCwd(1234);
			expect(result).toBe("/home/user/project");
			expect(readlinkMock).toHaveBeenCalledWith("/proc/1234/cwd");
		});

		test("should return undefined when readlink fails", async () => {
			const readlinkMock = mock(() => Promise.reject(new Error("Permission denied")));
			mock.module("node:fs/promises", () => ({
				readlink: readlinkMock,
			}));

			const result = await getProcessCwd(1234);
			expect(result).toBeUndefined();
		});
	});

	describe("checkTmuxAvailable", () => {
		test("should return true when tmux is available", async () => {
			const execMock = mock(() => Promise.resolve({ stdout: "session1\nsession2", stderr: "" }));
			mock.module("node:child_process", () => ({
				exec: execMock,
			}));
			mock.module("node:util", () => ({
				promisify: mock(() => execMock),
			}));

			const result = await checkTmuxAvailable();
			expect(result).toBe(true);
		});

		test("should return false when tmux is not available", async () => {
			const execMock = mock(() => Promise.reject(new Error("tmux not found")));
			mock.module("node:child_process", () => ({
				exec: execMock,
			}));
			mock.module("node:util", () => ({
				promisify: mock(() => execMock),
			}));

			const result = await checkTmuxAvailable();
			expect(result).toBe(false);
		});
	});

	describe("getTmuxPanes", () => {
		test("should parse tmux panes output correctly", async () => {
			const execMock = mock(() => Promise.resolve({ 
				stdout: "main:0.0:1234:claude\nother:1.0:5678:bash", 
				stderr: "" 
			}));
			mock.module("node:child_process", () => ({
				exec: execMock,
			}));
			mock.module("node:util", () => ({
				promisify: mock(() => execMock),
			}));

			const result = await getTmuxPanes();
			expect(result).toEqual([
				{
					session: "main",
					window: "0",
					pane: "0",
					pid: 1234,
					command: "claude",
				},
				{
					session: "other",
					window: "1", 
					pane: "0",
					pid: 5678,
					command: "bash",
				},
			]);
		});

		test("should return empty array when tmux command fails", async () => {
			const execMock = mock(() => Promise.reject(new Error("tmux not running")));
			mock.module("node:child_process", () => ({
				exec: execMock,
			}));
			mock.module("node:util", () => ({
				promisify: mock(() => execMock),
			}));

			const result = await getTmuxPanes();
			expect(result).toEqual([]);
		});
	});

	describe("sendToTmuxPane", () => {
		test("should send content to specific tmux pane", async () => {
			const execMock = mock(() => Promise.resolve({ stdout: "", stderr: "" }));
			mock.module("node:child_process", () => ({
				exec: execMock,
			}));
			mock.module("node:util", () => ({
				promisify: mock(() => execMock),
			}));

			await sendToTmuxPane("main", "0", "0", "test content");
			expect(execMock).toHaveBeenCalledWith("tmux send-keys -t 'main:0.0' 'test content' C-m");
		});

		test("should escape single quotes in content", async () => {
			const execMock = mock(() => Promise.resolve({ stdout: "", stderr: "" }));
			mock.module("node:child_process", () => ({
				exec: execMock,
			}));
			mock.module("node:util", () => ({
				promisify: mock(() => execMock),
			}));

			await sendToTmuxPane("main", "0", "0", "test 'quoted' content");
			expect(execMock).toHaveBeenCalledWith("tmux send-keys -t 'main:0.0' 'test '\\''quoted'\\'' content' C-m");
		});
	});

	describe("copyToClipboard", () => {
		test("should copy content to clipboard", async () => {
			const writeMock = mock(() => Promise.resolve());
			mock.module("clipboardy", () => ({
				default: {
					write: writeMock,
				},
			}));

			await copyToClipboard("test content");
			expect(writeMock).toHaveBeenCalledWith("test content");
		});
	});

	describe("sendContentToProcess", () => {
		test("should send to tmux pane when tmux info available", async () => {
			const execMock = mock(() => Promise.resolve({ stdout: "", stderr: "" }));
			mock.module("node:child_process", () => ({
				exec: execMock,
			}));
			mock.module("node:util", () => ({
				promisify: mock(() => execMock),
			}));

			const process: ClaudeProcess = {
				pid: 1234,
				name: "claude",
				tmuxSession: "main",
				tmuxWindow: "0",
				tmuxPane: "0",
			};

			await sendContentToProcess(process, "test content");
			expect(execMock).toHaveBeenCalledWith("tmux send-keys -t 'main:0.0' 'test content' C-m");
		});

		test("should fallback to new claude when no tmux info", async () => {
			const execMock = mock(() => Promise.resolve({ stdout: "", stderr: "" }));
			mock.module("node:child_process", () => ({
				exec: execMock,
			}));
			mock.module("node:util", () => ({
				promisify: mock(() => execMock),
			}));

			const process: ClaudeProcess = {
				pid: 1234,
				name: "claude",
			};

			await sendContentToProcess(process, "test content");
			expect(execMock).toHaveBeenCalledWith("echo 'test content' | claude");
		});

		test("should copy to clipboard when all methods fail", async () => {
			const execMock = mock(() => Promise.reject(new Error("Command failed")));
			mock.module("node:child_process", () => ({
				exec: execMock,
			}));
			mock.module("node:util", () => ({
				promisify: mock(() => execMock),
			}));

			const writeMock = mock(() => Promise.resolve());
			mock.module("clipboardy", () => ({
				default: {
					write: writeMock,
				},
			}));

			const process: ClaudeProcess = {
				pid: 1234,
				name: "claude",
				tmuxSession: "main",
				tmuxWindow: "0", 
				tmuxPane: "0",
			};

			await expect(sendContentToProcess(process, "test content"))
				.rejects.toThrow("Failed to send to process. Content copied to clipboard");
			expect(writeMock).toHaveBeenCalledWith("test content");
		});
	});
});