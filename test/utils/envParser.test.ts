import { describe, expect, test } from "bun:test";
import { parseEnvVars } from "../../src/utils/envParser";

describe("parseEnvVars", () => {
	test("should return empty object for undefined input", () => {
		expect(parseEnvVars(undefined)).toEqual({});
	});

	test("should return empty object for empty array", () => {
		expect(parseEnvVars([])).toEqual({});
	});

	test("should parse single environment variable", () => {
		expect(parseEnvVars(["FOO=bar"])).toEqual({ FOO: "bar" });
	});

	test("should parse multiple environment variables", () => {
		expect(parseEnvVars(["FOO=bar", "BAZ=qux"])).toEqual({
			FOO: "bar",
			BAZ: "qux",
		});
	});

	test("should handle values containing equals signs", () => {
		expect(parseEnvVars(["URL=https://example.com?foo=bar"])).toEqual({
			URL: "https://example.com?foo=bar",
		});
	});

	test("should handle empty values", () => {
		expect(parseEnvVars(["EMPTY="])).toEqual({ EMPTY: "" });
	});

	test("should throw error for invalid format without equals sign", () => {
		expect(() => parseEnvVars(["INVALID"])).toThrow(
			"Invalid environment variable format: INVALID",
		);
	});

	test("should throw error for format with only equals sign", () => {
		expect(() => parseEnvVars(["=value"])).toThrow(
			"Invalid environment variable format: =value",
		);
	});
});