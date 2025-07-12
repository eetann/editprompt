import { beforeEach, describe, expect, mock, test } from "bun:test";

describe("TempFile Utility", () => {
	beforeEach(() => {
		mock.restore();
	});

	describe("createTempFile", () => {
		test("should create temporary file with correct naming pattern", async () => {
			// Dynamic import to ensure fresh module
			const { createTempFile } = await import("../../src/utils/tempFile");

			// This test just verifies that the function runs without throwing
			// and returns a string that looks like a file path
			const result = await createTempFile();

			expect(typeof result).toBe("string");
			expect(result).toMatch(/\.editprompt-\d{14}\.md$/);
		});

		test("should handle basic functionality", async () => {
			// Simple functional test without complex mocking
			const { createTempFile } = await import("../../src/utils/tempFile");

			const result = await createTempFile();
			expect(result).toBeDefined();
			expect(typeof result).toBe("string");
		});
	});
});
