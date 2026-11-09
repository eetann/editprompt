import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getBackend, hasBackend, unregisterBackend } from "../../src/backends/registry";
import {
  getConfigDir,
  hasConfigFiles,
  loadUserConfig,
  mayUseConfiguredBackend,
  registerConfiguredBackends,
} from "../../src/config/userConfig";

const BACKEND = {
  currentPane: { env: "MYTTY_PANE_ID" },
  paneExists: ["mytty", "exists", "{pane}"],
  focus: ["mytty", "focus", "{pane}"],
  sendText: { argv: ["mytty", "send", "{pane}"], stdin: true },
  sendKey: ["mytty", "key", "{pane}", "{key}"],
};

let root: string;
let configDir: string;
let originalEnv: NodeJS.ProcessEnv;

beforeEach(async () => {
  originalEnv = { ...process.env };
  root = await mkdtemp(join(tmpdir(), "editprompt-config-"));
  configDir = join(root, "config", "editprompt");
  await mkdir(configDir, { recursive: true });
  // Keep the user's own RC files out of the tests.
  process.env.HOME = join(root, "home");
  process.env.XDG_CONFIG_HOME = join(root, "xdg");
});

afterEach(async () => {
  process.env = originalEnv;
  await rm(root, { recursive: true, force: true });
  for (const name of ["mytty", "othertty"]) {
    if (hasBackend(name)) {
      unregisterBackend(name);
    }
  }
});

describe("getConfigDir", () => {
  test("prefers EDITPROMPT_CONFIG_DIR, then XDG_CONFIG_HOME, then ~/.config", () => {
    expect(getConfigDir({ EDITPROMPT_CONFIG_DIR: "/a", XDG_CONFIG_HOME: "/b" })).toBe("/a");
    expect(getConfigDir({ XDG_CONFIG_HOME: "/b" })).toBe("/b/editprompt");
    expect(getConfigDir({})).toMatch(/\.config\/editprompt$/);
  });
});

describe("loadUserConfig", () => {
  const formats: [string, string][] = [
    [
      "config.jsonc",
      `{\n  // a comment\n  "backends": { "mytty": { "focus": ["mytty", "focus", "{pane}"] } },\n}\n`,
    ],
    ["config.json", `{ "backends": { "mytty": { "focus": ["mytty", "focus", "{pane}"] } } }`],
    ["config.json5", `{ backends: { mytty: { focus: ["mytty", "focus", "{pane}"] } } }`],
    ["config.yaml", `backends:\n  mytty:\n    focus: [mytty, focus, "{pane}"]\n`],
    ["config.yml", `backends:\n  mytty:\n    focus: [mytty, focus, "{pane}"]\n`],
    ["config.toml", `[backends.mytty]\nfocus = ["mytty", "focus", "{pane}"]\n`],
    [
      "config.js",
      `export default { backends: { mytty: { focus: ["mytty", "focus", "{pane}"] } } };\n`,
    ],
    [
      "config.mjs",
      `export default { backends: { mytty: { focus: ["mytty", "focus", "{pane}"] } } };\n`,
    ],
    [
      "config.cjs",
      `module.exports = { backends: { mytty: { focus: ["mytty", "focus", "{pane}"] } } };\n`,
    ],
    [
      "config.ts",
      `const focus: string[] = ["mytty", "focus", "{pane}"];\nexport default { backends: { mytty: { focus } } };\n`,
    ],
    [
      "config.mts",
      `const focus: string[] = ["mytty", "focus", "{pane}"];\nexport default { backends: { mytty: { focus } } };\n`,
    ],
    [
      "config.cts",
      `const focus: string[] = ["mytty", "focus", "{pane}"];\nmodule.exports = { backends: { mytty: { focus } } };\n`,
    ],
  ];

  for (const [fileName, content] of formats) {
    test(`loads ${fileName}`, async () => {
      await writeFile(join(configDir, fileName), content);

      const config = await loadUserConfig(configDir);

      expect(config.backends).toEqual({ mytty: { focus: ["mytty", "focus", "{pane}"] } });
    });
  }

  test("loads the RC file from the config directory", async () => {
    await writeFile(join(configDir, ".editpromptrc"), "backends.mytty.submitKey=C-m\n");

    expect((await loadUserConfig(configDir)).backends).toEqual({ mytty: { submitKey: "C-m" } });
  });

  test("returns an empty configuration when there is no file", async () => {
    expect(await loadUserConfig(configDir)).toEqual({});
  });

  test("does not read a config file from the current working directory", async () => {
    const project = join(root, "project");
    await mkdir(project);
    await writeFile(join(project, "editprompt.config.json"), `{ "backends": { "evil": {} } }`);
    await writeFile(join(project, "config.json"), `{ "backends": { "evil": {} } }`);
    const originalCwd = process.cwd();
    process.chdir(project);
    try {
      expect(await loadUserConfig(configDir)).toEqual({});
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe("registerConfiguredBackends", () => {
  test("registers valid backends and reports invalid ones", () => {
    const errors = registerConfiguredBackends({
      backends: { mytty: BACKEND, othertty: { focus: ["x"] }, tmux: BACKEND },
    });

    expect(getBackend("mytty").name).toBe("mytty");
    expect(hasBackend("othertty")).toBe(false);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("backends.othertty.currentPane is required");
    expect(errors[1]).toBe("backends.tmux: 'tmux' is a built-in backend and cannot be redefined");
  });

  test("rejects a backends value that is not an object", () => {
    expect(registerConfiguredBackends({ backends: [] as never })).toEqual([
      "backends must be an object keyed by backend name",
    ]);
  });

  test("registers a backend loaded from config.jsonc end to end", async () => {
    await writeFile(
      join(configDir, "config.jsonc"),
      JSON.stringify({ backends: { mytty: BACKEND } }),
    );

    expect(registerConfiguredBackends(await loadUserConfig(configDir))).toEqual([]);
    expect(getBackend("mytty").defaultSubmitKey).toBe("Enter");
  });
});

describe("mayUseConfiguredBackend", () => {
  test("skips the configuration when a built-in backend is named explicitly", () => {
    expect(mayUseConfiguredBackend(["open", "--mux", "wezterm"], {})).toBe(false);
    expect(mayUseConfiguredBackend(["open", "-m", "tmux"], {})).toBe(false);
    expect(mayUseConfiguredBackend(["open", "--mux=herdr"], {})).toBe(false);
    expect(mayUseConfiguredBackend(["input"], { EDITPROMPT_MUX: "rex" })).toBe(false);
  });

  test("loads the configuration when a non-built-in backend is named", () => {
    expect(mayUseConfiguredBackend(["open", "--mux", "mytty"], {})).toBe(true);
    expect(mayUseConfiguredBackend(["input"], { EDITPROMPT_MUX: "mytty" })).toBe(true);
    expect(mayUseConfiguredBackend(["open", "--mux", "mytty"], { EDITPROMPT_MUX: "tmux" })).toBe(
      true,
    );
  });

  test("ignores --mux inside content after --", () => {
    expect(
      mayUseConfiguredBackend(["input", "--", "--mux", "mytty"], { EDITPROMPT_MUX: "tmux" }),
    ).toBe(false);
  });

  test("loads the configuration only when detection would fall back to tmux", () => {
    expect(mayUseConfiguredBackend(["open"], {})).toBe(true);
    expect(mayUseConfiguredBackend(["open"], { NIWATERM_TAB_ID: "tab-1" })).toBe(false);
  });
});

describe("hasConfigFiles", () => {
  test("detects the config directory and the user RC file", async () => {
    const xdg = join(root, "xdg");
    expect(hasConfigFiles(join(root, "missing"), { XDG_CONFIG_HOME: xdg })).toBe(false);
    expect(hasConfigFiles(configDir, { XDG_CONFIG_HOME: xdg })).toBe(true);

    await mkdir(xdg, { recursive: true });
    await writeFile(join(xdg, ".editpromptrc"), "backends.mytty.submitKey=C-m\n");
    expect(hasConfigFiles(join(root, "missing"), { XDG_CONFIG_HOME: xdg })).toBe(true);
  });
});
