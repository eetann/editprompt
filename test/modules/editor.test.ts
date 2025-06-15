import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { 
	getEditor, 
	launchEditor, 
	readFileContent, 
	openEditorAndGetContent 
} from "../../src/modules/editor";

// Mock external dependencies
mock.module("node:child_process", () => ({
	spawn: mock(),
}));

mock.module("node:fs/promises", () => ({
	readFile: mock(),
}));

mock.module("../../src/utils/tempFile", () => ({
	createTempFile: mock(),
}));

describe("Editor Module", () => {
	beforeEach(() => {
		// Reset all mocks
		mock.restore();
	});

	afterEach(() => {
		// Clean up environment variables
		delete process.env.EDITOR;
	});

	describe("getEditor", () => {
		test("should return provided editor option", () => {
			const result = getEditor("nvim");
			expect(result).toBe("nvim");
		});

		test("should return EDITOR environment variable when no option provided", () => {
			process.env.EDITOR = "code";
			const result = getEditor();
			expect(result).toBe("code");
		});

		test("should return default editor when no option or env var", () => {
			const result = getEditor();
			expect(result).toBe("vi");
		});

		test("should prioritize option over environment variable", () => {
			process.env.EDITOR = "code";
			const result = getEditor("nvim");
			expect(result).toBe("nvim");
		});
	});

	describe("launchEditor", () => {
		test("should spawn editor process successfully", async () => {
			const mockProcess = {
				on: mock((event: string, callback: Function) => {
					if (event === "exit") {
						// Simulate successful exit
						setTimeout(() => callback(0), 10);
					}
				}),
			};

			const spawnMock = mock(() => mockProcess);
			mock.module("node:child_process", () => ({
				spawn: spawnMock,
			}));

			await expect(launchEditor("vim", "/tmp/test.md")).resolves.toBeUndefined();
			expect(spawnMock).toHaveBeenCalledWith("vim", ["/tmp/test.md"], {
				stdio: "inherit",
				shell: true,
			});
		});

		test("should reject when editor process fails", async () => {
			const mockProcess = {
				on: mock((event: string, callback: Function) => {
					if (event === "error") {
						setTimeout(() => callback(new Error("Editor not found")), 10);
					}
				}),
			};

			const spawnMock = mock(() => mockProcess);
			mock.module("node:child_process", () => ({
				spawn: spawnMock,
			}));

			await expect(launchEditor("nonexistent-editor", "/tmp/test.md"))
				.rejects.toThrow("Failed to launch editor: Editor not found");
		});

		test("should reject when editor exits with non-zero code", async () => {
			const mockProcess = {
				on: mock((event: string, callback: Function) => {
					if (event === "exit") {
						setTimeout(() => callback(1), 10);
					}
				}),
			};

			const spawnMock = mock(() => mockProcess);
			mock.module("node:child_process", () => ({
				spawn: spawnMock,
			}));

			await expect(launchEditor("vim", "/tmp/test.md"))
				.rejects.toThrow("Editor exited with code: 1");
		});
	});

	describe("readFileContent", () => {
		test("should read and trim file content", async () => {
			const readFileMock = mock(() => Promise.resolve("  Hello World  \n"));
			mock.module("node:fs/promises", () => ({
				readFile: readFileMock,
			}));

			const result = await readFileContent("/tmp/test.md");
			expect(result).toBe("Hello World");
			expect(readFileMock).toHaveBeenCalledWith("/tmp/test.md", "utf-8");
		});

		test("should throw error when file read fails", async () => {
			const readFileMock = mock(() => Promise.reject(new Error("File not found")));
			mock.module("node:fs/promises", () => ({
				readFile: readFileMock,
			}));

			await expect(readFileContent("/tmp/nonexistent.md"))
				.rejects.toThrow("Failed to read file: File not found");
		});
	});

	describe("openEditorAndGetContent", () => {
		test("should complete full editor workflow successfully", async () => {
			const createTempFileMock = mock(() => Promise.resolve("/tmp/test.md"));
			mock.module("../../src/utils/tempFile", () => ({
				createTempFile: createTempFileMock,
			}));

			const mockProcess = {
				on: mock((event: string, callback: Function) => {
					if (event === "exit") {
						setTimeout(() => callback(0), 10);
					}
				}),
			};

			const spawnMock = mock(() => mockProcess);
			mock.module("node:child_process", () => ({
				spawn: spawnMock,
			}));

			const readFileMock = mock(() => Promise.resolve("Test content"));
			mock.module("node:fs/promises", () => ({
				readFile: readFileMock,
			}));

			const result = await openEditorAndGetContent("vim");
			expect(result).toBe("Test content");
			expect(createTempFileMock).toHaveBeenCalled();
			expect(spawnMock).toHaveBeenCalledWith("vim", ["/tmp/test.md"], {
				stdio: "inherit",
				shell: true,
			});
			expect(readFileMock).toHaveBeenCalledWith("/tmp/test.md", "utf-8");
		});

		test("should throw error when no content is entered", async () => {
			const createTempFileMock = mock(() => Promise.resolve("/tmp/test.md"));
			mock.module("../../src/utils/tempFile", () => ({
				createTempFile: createTempFileMock,
			}));

			const mockProcess = {
				on: mock((event: string, callback: Function) => {
					if (event === "exit") {
						setTimeout(() => callback(0), 10);
					}
				}),
			};

			const spawnMock = mock(() => mockProcess);
			mock.module("node:child_process", () => ({
				spawn: spawnMock,
			}));

			const readFileMock = mock(() => Promise.resolve(""));
			mock.module("node:fs/promises", () => ({
				readFile: readFileMock,
			}));

			await expect(openEditorAndGetContent("vim"))
				.rejects.toThrow("No content was entered in the editor");
		});
	});
});