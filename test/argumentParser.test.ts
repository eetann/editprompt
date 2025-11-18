import { describe, expect, test } from "bun:test";
import { $ } from "bun";

describe("extractRawContent (e2e with -- separator)", () => {
  test(
    'tsx test-cli.ts -- "foo --bar" should extract "foo --bar"',
    async () => {
      const result =
        await $`bunx tsx test/fixtures/test-cli.ts -- "foo --bar"`.nothrow();
      const output = result.stdout.toString().trim();

      expect(output).toBe("foo --bar");
    },
    { timeout: 10000 },
  );

  test(
    "tsx test-cli.ts -- foo --bar should extract foo --bar",
    async () => {
      const result =
        await $`bunx tsx test/fixtures/test-cli.ts -- foo --bar`.nothrow();
      const output = result.stdout.toString().trim();

      expect(output).toBe("foo --bar");
    },
    { timeout: 10000 },
  );

  test(
    "bun test-cli.ts -- -- foo --bar should extract foo --bar",
    async () => {
      const result =
        await $`bun test/fixtures/test-cli.ts -- -- foo --bar`.nothrow();
      const output = result.stdout.toString().trim();

      expect(output).toBe("foo --bar");
    },
    { timeout: 10000 },
  );

  test(
    'tsx test-cli.ts "hello world" (without -- and no options) should extract first positional',
    async () => {
      const result =
        await $`bunx tsx test/fixtures/test-cli.ts "hello world"`.nothrow();
      const output = result.stdout.toString().trim();

      expect(output).toBe("hello world");
    },
    { timeout: 10000 },
  );

  test(
    'tsx test-cli.ts "foo --bar" (without --) treats --bar as option and returns undefined',
    async () => {
      const result =
        await $`bunx tsx test/fixtures/test-cli.ts "foo --bar"`.nothrow();
      const output = result.stdout.toString().trim();

      // --bar is treated as an option, so no content is extracted
      expect(output).toBe("undefined");
    },
    { timeout: 10000 },
  );

  test(
    "tsx test-cli.ts -- (empty content) should return undefined",
    async () => {
      const result = await $`bunx tsx test/fixtures/test-cli.ts --`.nothrow();
      const output = result.stdout.toString().trim();

      expect(output).toBe("undefined");
    },
    { timeout: 10000 },
  );
});
