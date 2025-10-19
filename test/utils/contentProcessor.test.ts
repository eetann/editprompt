import { describe, expect, test } from "bun:test";
import { processContent } from "../../src/utils/contentProcessor";

describe("processContent", () => {
  test("通常のテキストはそのまま返す", () => {
    const input = "Hello, World!";
    const result = processContent(input);
    expect(result).toBe("Hello, World!");
  });

  test("末尾改行が削除される", () => {
    const input = "Hello, World!\n";
    const result = processContent(input);
    expect(result).toBe("Hello, World!");
  });

  test("@で終わる行に末尾スペースが追加される", () => {
    const input = "foo@";
    const result = processContent(input);
    expect(result).toBe("foo@ ");
  });

  test("@で終わる行かつ末尾改行も処理される", () => {
    const input = "foo@\n";
    const result = processContent(input);
    expect(result).toBe("foo@ ");
  });
});
