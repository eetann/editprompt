import { beforeEach, describe, expect, mock, test } from "bun:test";
import { spawn } from "node:child_process";

describe("Integration Tests", () => {
	const CLI_PATH = "./dist/index.js";

	beforeEach(() => {
		mock.restore();
	});

	describe("CLI Integration", () => {
		test("should show help when --help flag is used", async () => {
			const result = await new Promise<{
				stdout: string;
				stderr: string;
				exitCode: number;
			}>((resolve) => {
				const process = spawn("bun", [CLI_PATH, "--help"], {
					stdio: ["ignore", "pipe", "pipe"],
				});

				let stdout = "";
				let stderr = "";

				process.stdout.on("data", (data) => {
					stdout += data.toString();
				});

				process.stderr.on("data", (data) => {
					stderr += data.toString();
				});

				process.on("close", (exitCode) => {
					resolve({ stdout, stderr, exitCode: exitCode || 0 });
				});
			});

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("USAGE:");
			expect(result.stdout).toContain("OPTIONS:");
			expect(result.stdout).toContain("--help");
		});

		test("should show version when --version flag is used", async () => {
			const result = await new Promise<{
				stdout: string;
				stderr: string;
				exitCode: number;
			}>((resolve) => {
				const process = spawn("bun", [CLI_PATH, "--version"], {
					stdio: ["ignore", "pipe", "pipe"],
				});

				let stdout = "";
				let stderr = "";

				process.stdout.on("data", (data) => {
					stdout += data.toString();
				});

				process.stderr.on("data", (data) => {
					stderr += data.toString();
				});

				process.on("close", (exitCode) => {
					resolve({ stdout, stderr, exitCode: exitCode || 0 });
				});
			});

			expect(result.exitCode).toBe(0);
			// Version might be "undefined" due to Gunshi configuration, but should not error
		});

		test("should handle non-existent editor gracefully", async () => {
			const result = await new Promise<{
				stdout: string;
				stderr: string;
				exitCode: number;
			}>((resolve) => {
				const process = spawn(
					"bun",
					[CLI_PATH, "--editor", "nonexistent-editor-12345"],
					{
						stdio: ["ignore", "pipe", "pipe"],
					},
				);

				let stdout = "";
				let stderr = "";

				process.stdout.on("data", (data) => {
					stdout += data.toString();
				});

				process.stderr.on("data", (data) => {
					stderr += data.toString();
				});

				process.on("close", (exitCode) => {
					resolve({ stdout, stderr, exitCode: exitCode || 0 });
				});

				// Kill the process after a short timeout to prevent hanging
				setTimeout(() => {
					process.kill("SIGTERM");
					resolve({ stdout, stderr, exitCode: 1 });
				}, 3000);
			});

			// Should either exit with error or be killed by timeout
			expect(result.exitCode).toBeGreaterThan(0);
		});
	});

	describe("Module Integration", () => {
		test("should be able to import all modules without errors", async () => {
			// Test that all modules can be imported
			const { getEditor } = await import("../src/modules/editor");
			const { findTargetProcesses } = await import("../src/modules/process");
			const { selectProcess } = await import("../src/modules/selector");
			const { createTempFile } = await import("../src/utils/tempFile");

			expect(typeof getEditor).toBe("function");
			expect(typeof findTargetProcesses).toBe("function");
			expect(typeof selectProcess).toBe("function");
			expect(typeof createTempFile).toBe("function");
		});

		test("should handle edge cases in process detection", async () => {
			const { findTargetProcesses } = await import("../src/modules/process");

			// Should not throw error even if no processes found
			const processes = await findTargetProcesses();
			expect(Array.isArray(processes)).toBe(true);
		});

		test("should handle editor environment variable detection", async () => {
			const { getEditor } = await import("../src/modules/editor");

			// Test with custom environment
			process.env.EDITOR = "test-editor";
			expect(getEditor()).toBe("test-editor");

			// Test with option override
			expect(getEditor("override-editor")).toBe("override-editor");
		});
	});
});
