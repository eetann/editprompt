import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  getEditor,
  launchEditor,
  openEditorAndGetContent,
  readFileContent,
} from "../../src/modules/editor";

async function cleanupTempFile(filePath: string): Promise<void> {
  await rm(filePath, { force: true });
  await rm(dirname(filePath), { recursive: true, force: true });
}

describe("Editor Module", () => {
  beforeEach(() => {
    // Reset all mocks
    mock.restore();
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
      process.env.EDITOR = undefined;
      const result = getEditor();
      expect(result).toBe("vim");
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
        on: mock((event: string, callback): void => {
          if (event === "exit") {
            // Simulate successful exit
            setTimeout(() => callback(0), 10);
          }
        }),
      };

      const spawnMock = mock(() => mockProcess);
      void mock.module("node:child_process", () => ({
        spawn: spawnMock,
      }));

      expect(launchEditor("vim", "/tmp/test.md")).resolves.toBeUndefined();
      expect(spawnMock).toHaveBeenCalledWith("vim", ["/tmp/test.md"], {
        stdio: "inherit",
        shell: true,
        env: expect.objectContaining({
          EDITPROMPT: "1",
        }),
      });
    });

    test("should reject when editor process fails", async () => {
      const mockProcess = {
        on: mock((event: string, callback) => {
          if (event === "error") {
            setTimeout(() => callback(new Error("Editor not found")), 10);
          }
        }),
      };

      const spawnMock = mock(() => mockProcess);
      void mock.module("node:child_process", () => ({
        spawn: spawnMock,
      }));

      expect(launchEditor("nonexistent-editor", "/tmp/test.md")).rejects.toThrow(
        "Failed to launch editor: Editor not found",
      );
    });

    test("should reject when editor exits with non-zero code", async () => {
      const mockProcess = {
        on: mock((event: string, callback) => {
          if (event === "exit") {
            setTimeout(() => callback(1), 10);
          }
        }),
      };

      const spawnMock = mock(() => mockProcess);
      void mock.module("node:child_process", () => ({
        spawn: spawnMock,
      }));

      expect(launchEditor("vim", "/tmp/test.md")).rejects.toThrow("Editor exited with code: 1");
    });
  });

  describe("readFileContent", () => {
    test("should read and trim file content", async () => {
      const readFileMock = mock(() => Promise.resolve("Hello World\n"));
      void mock.module("node:fs/promises", () => ({
        readFile: readFileMock,
      }));

      const result = await readFileContent("/tmp/test.md");
      expect(result).toBe("Hello World");
      expect(readFileMock).toHaveBeenCalledWith("/tmp/test.md", "utf-8");
    });

    test("should throw error when file read fails", async () => {
      const readFileMock = mock(() => Promise.reject(new Error("File not found")));
      void mock.module("node:fs/promises", () => ({
        readFile: readFileMock,
      }));

      expect(readFileContent("/tmp/nonexistent.md")).rejects.toThrow(
        "Failed to read file: File not found",
      );
    });

    test("should add space when content ends with @-prefixed string", async () => {
      const readFileMock = mock(() => Promise.resolve("foo\n@path/to/file\n"));
      void mock.module("node:fs/promises", () => ({
        readFile: readFileMock,
      }));

      const result = await readFileContent("/tmp/test.md");
      expect(result).toBe("foo\n@path/to/file ");
    });

    test("should add space when line ends with @-prefixed string in middle", async () => {
      const readFileMock = mock(() => Promise.resolve("foo\nbar @path/to/file\n"));
      void mock.module("node:fs/promises", () => ({
        readFile: readFileMock,
      }));

      const result = await readFileContent("/tmp/test.md");
      expect(result).toBe("foo\nbar @path/to/file ");
    });

    test("should not add space when @ appears in middle lines but not at the end", async () => {
      const readFileMock = mock(() => Promise.resolve("foo @path/to/file\nbar\n"));
      void mock.module("node:fs/promises", () => ({
        readFile: readFileMock,
      }));

      const result = await readFileContent("/tmp/test.md");
      expect(result).toBe("foo @path/to/file\nbar");
    });
  });

  describe("openEditorAndGetContent", () => {
    test("should complete full editor workflow successfully", async () => {
      let tempFilePath: string | undefined;

      const spawnMock = mock((_editor: string, args: string[]) => {
        tempFilePath = args[0];
        return {
          on: mock((event: string, callback) => {
            if (event === "exit") {
              setTimeout(() => callback(0), 10);
            }
          }),
        };
      });
      void mock.module("node:child_process", () => ({
        spawn: spawnMock,
      }));

      const readFileMock = mock(() => Promise.resolve("Test content"));
      void mock.module("node:fs/promises", () => ({
        mkdir,
        readFile: readFileMock,
        rm,
        writeFile,
      }));

      try {
        const result = await openEditorAndGetContent("vim");
        expect(result).toBe("Test content");
        expect(spawnMock).toHaveBeenCalledWith("vim", [expect.any(String)], {
          stdio: "inherit",
          shell: true,
          env: expect.objectContaining({
            EDITPROMPT: "1",
          }),
        });
      } finally {
        if (tempFilePath) {
          await cleanupTempFile(tempFilePath);
        }
      }
    });

    test("should throw error when no content is entered", async () => {
      let tempFilePath: string | undefined;

      const spawnMock = mock((_editor: string, args: string[]) => {
        tempFilePath = args[0];
        return {
          on: mock((event: string, callback) => {
            if (event === "exit") {
              setTimeout(() => callback(0), 10);
            }
          }),
        };
      });
      void mock.module("node:child_process", () => ({
        spawn: spawnMock,
      }));

      const readFileMock = mock(() => Promise.resolve(""));
      void mock.module("node:fs/promises", () => ({
        mkdir,
        readFile: readFileMock,
        rm,
        writeFile,
      }));

      try {
        const result = await openEditorAndGetContent("vim");
        expect(result).toBe("");
        expect(spawnMock).toHaveBeenCalledWith("vim", [expect.any(String)], {
          stdio: "inherit",
          shell: true,
          env: expect.objectContaining({
            EDITPROMPT: "1",
          }),
        });
      } finally {
        if (tempFilePath) {
          await cleanupTempFile(tempFilePath);
        }
      }
    });
  });
});
