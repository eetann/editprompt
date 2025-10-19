import { beforeEach, describe, expect, test } from "bun:test";
import { readSendConfig } from "../../src/utils/sendConfig";

describe("readSendConfig", () => {
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		// 環境変数のバックアップ
		originalEnv = { ...process.env };
	});

	test("正常系 - すべての環境変数が設定されている", () => {
		process.env.EDITPROMPT_TARGET_PANE = "%0";
		process.env.EDITPROMPT_MUX = "tmux";
		process.env.EDITPROMPT_ALWAYS_COPY = "1";

		const config = readSendConfig();

		expect(config.targetPane).toBe("%0");
		expect(config.mux).toBe("tmux");
		expect(config.alwaysCopy).toBe(true);

		// 環境変数を復元
		process.env = originalEnv;
	});

	test("異常系 - EDITPROMPT_MUXが不正な値", () => {
		process.env.EDITPROMPT_TARGET_PANE = "%0";
		process.env.EDITPROMPT_MUX = "invalid";
		process.env.EDITPROMPT_ALWAYS_COPY = "1";

		expect(() => readSendConfig()).toThrow();

		// 環境変数を復元
		process.env = originalEnv;
	});

	test("正常系 - EDITPROMPT_MUXが未設定の場合デフォルト値tmux", () => {
		process.env.EDITPROMPT_TARGET_PANE = "%0";
		delete process.env.EDITPROMPT_MUX;
		process.env.EDITPROMPT_ALWAYS_COPY = "0";

		const config = readSendConfig();

		expect(config.mux).toBe("tmux");

		// 環境変数を復元
		process.env = originalEnv;
	});

	test("正常系 - EDITPROMPT_ALWAYS_COPYが1の場合true", () => {
		process.env.EDITPROMPT_TARGET_PANE = "%0";
		process.env.EDITPROMPT_MUX = "tmux";
		process.env.EDITPROMPT_ALWAYS_COPY = "1";

		const config = readSendConfig();

		expect(config.alwaysCopy).toBe(true);

		// 環境変数を復元
		process.env = originalEnv;
	});
});
