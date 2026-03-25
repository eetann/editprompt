import { beforeEach, describe, expect, mock, test } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { basename, dirname } from "node:path";

describe("TempFile Utility", () => {
  beforeEach(() => {
    mock.restore();
  });

  describe("createTempFile", () => {
    test("should handle basic functionality", async () => {
      // Simple functional test without complex mocking
      const { createTempFile } = await import("../../src/utils/tempFile");

      const result = await createTempFile();
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(basename(result)).toMatch(/^\.editprompt-\d{14}-[0-9a-f]{8}\.md$/);
      expect(await readFile(result, "utf-8")).toBe("");

      await rm(result, { force: true });
      await rm(dirname(result), { recursive: true, force: true });
    });

    test("should create a unique path for each call", async () => {
      const { createTempFile } = await import("../../src/utils/tempFile");

      const firstPath = await createTempFile();
      const secondPath = await createTempFile();

      expect(firstPath).not.toBe(secondPath);

      await rm(firstPath, { force: true });
      await rm(secondPath, { force: true });
      await rm(dirname(firstPath), { recursive: true, force: true });
    });
  });
});
