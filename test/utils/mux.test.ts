import { describe, expect, test } from "bun:test";
import { isHerdrEnvironment, isNiwatermEnvironment, resolveMux } from "../../src/utils/mux";

const herdrEnv: NodeJS.ProcessEnv = {
  HERDR_SOCKET_PATH: "/tmp/herdr.sock",
  HERDR_PANE_ID: "w1:p1",
};

const niwatermEnv: NodeJS.ProcessEnv = {
  NIWATERM_TAB_ID: "tab-3",
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

  test("prefers Herdr detection over niwaterm when both are present", () => {
    expect(resolveMux(undefined, { ...herdrEnv, ...niwatermEnv })).toBe("herdr");
  });

  test("defaults to tmux outside Herdr and niwaterm", () => {
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
