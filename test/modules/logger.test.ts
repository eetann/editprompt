import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { resolveLogLevel } from "../../src/modules/logger";

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
