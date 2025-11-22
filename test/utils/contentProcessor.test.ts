import { describe, expect, test } from "bun:test";
import { processContent } from "../../src/utils/contentProcessor";

describe("processContent", () => {
  test("returns plain text as-is", () => {
    const input = "Hello, World!";
    const result = processContent(input);
    expect(result).toBe("Hello, World!");
  });

  test("removes trailing newline", () => {
    const input = "Hello, World!\n";
    const result = processContent(input);
    expect(result).toBe("Hello, World!");
  });

  test("adds trailing space to lines ending with @", () => {
    const input = "foo@";
    const result = processContent(input);
    expect(result).toBe("foo@ ");
  });

  test("processes both @ ending and trailing newline", () => {
    const input = "foo@\n";
    const result = processContent(input);
    expect(result).toBe("foo@ ");
  });
});
