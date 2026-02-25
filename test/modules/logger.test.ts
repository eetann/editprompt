import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { resolveLogLevel, resolveLogFilePath, resolveFileLogLevel } from "../../src/modules/logger";

describe("resolveLogLevel", () => {
	const originalEnv = process.env.EDITPROMPT_LOG_LEVEL;

	beforeEach(() => {
		delete process.env.EDITPROMPT_LOG_LEVEL;
	});

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.EDITPROMPT_LOG_LEVEL = originalEnv;
		} else {
			delete process.env.EDITPROMPT_LOG_LEVEL;
		}
	});

	it("should return null when quiet is true", () => {
		expect(resolveLogLevel({ quiet: true })).toBeNull();
	});

	it("should return 'debug' when verbose is true", () => {
		expect(resolveLogLevel({ verbose: true })).toBe("debug");
	});

	it("should return level from EDITPROMPT_LOG_LEVEL env var", () => {
		process.env.EDITPROMPT_LOG_LEVEL = "warning";
		expect(resolveLogLevel({})).toBe("warning");
	});

	it("should return 'info' as default when nothing is specified", () => {
		expect(resolveLogLevel({})).toBe("info");
	});

	it("should prioritize quiet over EDITPROMPT_LOG_LEVEL", () => {
		process.env.EDITPROMPT_LOG_LEVEL = "debug";
		expect(resolveLogLevel({ quiet: true })).toBeNull();
	});

	it("should prioritize verbose over EDITPROMPT_LOG_LEVEL", () => {
		process.env.EDITPROMPT_LOG_LEVEL = "warning";
		expect(resolveLogLevel({ verbose: true })).toBe("debug");
	});
});

describe("resolveLogFilePath", () => {
	const originalEnv = process.env.EDITPROMPT_LOG_FILE;

	beforeEach(() => {
		delete process.env.EDITPROMPT_LOG_FILE;
	});

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.EDITPROMPT_LOG_FILE = originalEnv;
		} else {
			delete process.env.EDITPROMPT_LOG_FILE;
		}
	});

	it("should return logFile from options when specified", () => {
		expect(resolveLogFilePath({ logFile: "/tmp/test.log" })).toBe("/tmp/test.log");
	});

	it("should return path from EDITPROMPT_LOG_FILE env var", () => {
		process.env.EDITPROMPT_LOG_FILE = "/tmp/env.log";
		expect(resolveLogFilePath({})).toBe("/tmp/env.log");
	});

	it("should prioritize logFile option over EDITPROMPT_LOG_FILE", () => {
		process.env.EDITPROMPT_LOG_FILE = "/tmp/env.log";
		expect(resolveLogFilePath({ logFile: "/tmp/cli.log" })).toBe("/tmp/cli.log");
	});

	it("should return undefined when neither is specified", () => {
		expect(resolveLogFilePath({})).toBeUndefined();
	});
});

describe("resolveFileLogLevel", () => {
	const originalEnv = process.env.EDITPROMPT_LOG_LEVEL;

	beforeEach(() => {
		delete process.env.EDITPROMPT_LOG_LEVEL;
	});

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.EDITPROMPT_LOG_LEVEL = originalEnv;
		} else {
			delete process.env.EDITPROMPT_LOG_LEVEL;
		}
	});

	it("should return 'info' when quiet is true (ignores quiet)", () => {
		expect(resolveFileLogLevel({ quiet: true })).toBe("info");
	});

	it("should return 'debug' when verbose is true", () => {
		expect(resolveFileLogLevel({ verbose: true })).toBe("debug");
	});

	it("should return level from EDITPROMPT_LOG_LEVEL env var", () => {
		process.env.EDITPROMPT_LOG_LEVEL = "warning";
		expect(resolveFileLogLevel({})).toBe("warning");
	});

	it("should return 'debug' when quiet and verbose are both true", () => {
		expect(resolveFileLogLevel({ quiet: true, verbose: true })).toBe("debug");
	});
});
