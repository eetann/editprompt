import { describe, expect, test } from "bun:test";
import {
  isHerdrEnvironment,
  isNiwatermEnvironment,
  isRexEnvironment,
  resolveMux,
} from "../../src/utils/mux";

const herdrEnv: NodeJS.ProcessEnv = {
  HERDR_SOCKET_PATH: "/tmp/herdr.sock",
  HERDR_PANE_ID: "w1:p1",
};

const niwatermEnv: NodeJS.ProcessEnv = {
  NIWATERM_TAB_ID: "tab-3",
};

const rexEnv: NodeJS.ProcessEnv = {
  REX_SESSION: "session:01a18b8b-f941-77a1-a135-5b96ea5827fb",
  REX_BLOCK: "block:01a18b8b-f942-717a-b4c5-f2f397bf64cb",
};

describe("isHerdrEnvironment", () => {
  test("detects a Herdr pane", () => {
    expect(isHerdrEnvironment(herdrEnv)).toBe(true);
  });

  test("detects a detached Herdr command with an active pane", () => {
    expect(
      isHerdrEnvironment({
        HERDR_SOCKET_PATH: "/tmp/herdr.sock",
        HERDR_ACTIVE_PANE_ID: "w1:p1",
      }),
    ).toBe(true);
  });

  test("requires both the socket path and a pane ID", () => {
    expect(isHerdrEnvironment({ HERDR_SOCKET_PATH: "/tmp/herdr.sock" })).toBe(false);
    expect(isHerdrEnvironment({ HERDR_PANE_ID: "w1:p1" })).toBe(false);
  });
});

describe("isNiwatermEnvironment", () => {
  test("detects a niwaterm tab", () => {
    expect(isNiwatermEnvironment(niwatermEnv)).toBe(true);
  });

  test("requires a non-empty tab ID", () => {
    expect(isNiwatermEnvironment({ NIWATERM_TAB_ID: "" })).toBe(false);
    expect(isNiwatermEnvironment({})).toBe(false);
  });
});

describe("isRexEnvironment", () => {
  test("detects a Rex block", () => {
    expect(isRexEnvironment(rexEnv)).toBe(true);
  });

  test("needs only the block ID, not the session", () => {
    expect(isRexEnvironment({ REX_BLOCK: rexEnv.REX_BLOCK })).toBe(true);
    expect(isRexEnvironment({ REX_SESSION: rexEnv.REX_SESSION })).toBe(false);
  });

  test("requires a non-empty block ID", () => {
    expect(isRexEnvironment({ REX_BLOCK: "" })).toBe(false);
    expect(isRexEnvironment({})).toBe(false);
  });
});

describe("resolveMux", () => {
  test("prefers an explicit mux over the environment", () => {
    expect(resolveMux("tmux", { ...herdrEnv, EDITPROMPT_MUX: "wezterm" })).toBe("tmux");
  });

  test("prefers EDITPROMPT_MUX over Herdr detection", () => {
    expect(resolveMux(undefined, { ...herdrEnv, EDITPROMPT_MUX: "wezterm" })).toBe("wezterm");
  });

  test("detects Herdr when no mux is explicitly configured", () => {
    expect(resolveMux(undefined, herdrEnv)).toBe("herdr");
  });

  test("detects niwaterm when no mux is explicitly configured", () => {
    expect(resolveMux(undefined, niwatermEnv)).toBe("niwaterm");
  });

  test("detects Rex when no mux is explicitly configured", () => {
    expect(resolveMux(undefined, rexEnv)).toBe("rex");
  });

  test("prefers EDITPROMPT_MUX over Rex detection", () => {
    expect(resolveMux(undefined, { ...rexEnv, EDITPROMPT_MUX: "tmux" })).toBe("tmux");
  });

  test("prefers Herdr detection over niwaterm when both are present", () => {
    expect(resolveMux(undefined, { ...herdrEnv, ...niwatermEnv })).toBe("herdr");
  });

  test("prefers Herdr and niwaterm detection over Rex when they are present", () => {
    expect(resolveMux(undefined, { ...herdrEnv, ...rexEnv })).toBe("herdr");
    expect(resolveMux(undefined, { ...niwatermEnv, ...rexEnv })).toBe("niwaterm");
  });

  test("defaults to tmux outside Herdr, niwaterm and Rex", () => {
    expect(resolveMux(undefined, {})).toBe("tmux");
  });

  test("rejects an invalid explicit mux", () => {
    expect(() => resolveMux("invalid", herdrEnv)).toThrow("Invalid multiplexer type");
  });

  test("rejects an invalid EDITPROMPT_MUX", () => {
    expect(() => resolveMux(undefined, { EDITPROMPT_MUX: "invalid" })).toThrow(
      "Invalid multiplexer type",
    );
  });
});
