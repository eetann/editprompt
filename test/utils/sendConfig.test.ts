import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readSendConfig } from "../../src/utils/sendConfig";

describe("readSendConfig", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Backup environment variables
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("reads all environment variables when set", () => {
    process.env.EDITPROMPT_MUX = "tmux";
    process.env.EDITPROMPT_ALWAYS_COPY = "1";

    const config = readSendConfig();

    expect(config.mux).toBe("tmux");
    expect(config.alwaysCopy).toBe(true);
  });

  test("throws error when EDITPROMPT_MUX has invalid value", () => {
    process.env.EDITPROMPT_MUX = "invalid";
    process.env.EDITPROMPT_ALWAYS_COPY = "1";

    expect(() => readSendConfig()).toThrow();
  });

  test("accepts herdr as a multiplexer", () => {
    process.env.EDITPROMPT_MUX = "herdr";

    const config = readSendConfig();

    expect(config.mux).toBe("herdr");
  });

  test("detects herdr when EDITPROMPT_MUX is not set", () => {
    delete process.env.EDITPROMPT_MUX;
    process.env.HERDR_SOCKET_PATH = "/tmp/herdr.sock";
    process.env.HERDR_PANE_ID = "w1:p1";

    const config = readSendConfig();

    expect(config.mux).toBe("herdr");
  });

  test("defaults to tmux when EDITPROMPT_MUX is not set", () => {
    delete process.env.EDITPROMPT_MUX;
    delete process.env.HERDR_SOCKET_PATH;
    delete process.env.HERDR_PANE_ID;
    delete process.env.HERDR_ACTIVE_PANE_ID;
    delete process.env.NIWATERM_TAB_ID;
    process.env.EDITPROMPT_ALWAYS_COPY = "0";

    const config = readSendConfig();

    expect(config.mux).toBe("tmux");
  });

  test("sets alwaysCopy to true when EDITPROMPT_ALWAYS_COPY is 1", () => {
    process.env.EDITPROMPT_MUX = "tmux";
    process.env.EDITPROMPT_ALWAYS_COPY = "1";

    const config = readSendConfig();

    expect(config.alwaysCopy).toBe(true);
  });

  test("defaults sendKeyDelay to 1000 when EDITPROMPT_SEND_KEY_DELAY is not set", () => {
    process.env.EDITPROMPT_MUX = "tmux";
    process.env.EDITPROMPT_SEND_KEY_DELAY = undefined;

    const config = readSendConfig();

    expect(config.sendKeyDelay).toBe(1000);
  });

  test("reads sendKeyDelay from EDITPROMPT_SEND_KEY_DELAY", () => {
    process.env.EDITPROMPT_MUX = "tmux";
    process.env.EDITPROMPT_SEND_KEY_DELAY = "2000";

    const config = readSendConfig();

    expect(config.sendKeyDelay).toBe(2000);
  });

  test("defaults sendKeyDelay to 1000 when EDITPROMPT_SEND_KEY_DELAY is invalid", () => {
    process.env.EDITPROMPT_MUX = "tmux";
    process.env.EDITPROMPT_SEND_KEY_DELAY = "abc";

    const config = readSendConfig();

    expect(config.sendKeyDelay).toBe(1000);
  });
});
