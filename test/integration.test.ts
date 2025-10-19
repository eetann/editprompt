import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("clipboardy", () => ({
  default: {
    write: mock(),
  },
}));

describe("Integration Tests", () => {
  beforeEach(() => {
    mock.restore();
  });

  describe("Module Integration", () => {
    test("should handle clipboard operations", async () => {
      const { copyToClipboard } = await import("../src/modules/process");

      // Should not throw error when copying to clipboard
      await copyToClipboard("test content");
      // If we get here without error, test passes
      expect(true).toBe(true);
    });

    test("should handle editor environment variable detection", async () => {
      const { getEditor } = await import("../src/modules/editor");

      // Test with custom environment
      process.env.EDITOR = "test-editor";
      expect(getEditor()).toBe("test-editor");

      // Test with option override
      expect(getEditor("override-editor")).toBe("override-editor");
    });

    test("should handle complete workflow with mock data", async () => {
      // Test the main workflow without external dependencies
      const { getEditor } = await import("../src/modules/editor");
      const { sendContentToPane } = await import("../src/modules/process");
      const { createTempFile } = await import("../src/utils/tempFile");

      // These functions should be callable without throwing
      expect(() => getEditor("vim")).not.toThrow();

      // sendContentToPane should throw when given invalid pane
      await expect(
        sendContentToPane("%invalid", "test", "tmux"),
      ).rejects.toThrow();

      const tempFile = await createTempFile();
      expect(typeof tempFile).toBe("string");
    });
  });
});
