import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommandBackendConfigError, createCommandBackend } from "../../src/backends/command";
import { canSplitPane } from "../../src/backends/types";
import { sendContentToPane } from "../../src/core/delivery";
import { markAsEditorPane } from "../../src/core/link";
import { conf } from "../../src/modules/conf";

// A fake terminal CLI: records each call's arguments and stdin, prints the
// content of $FAKE_DIR/stdout, and exits with the status in $FAKE_DIR/exit.
const FAKE_CLI = `#!/bin/sh
dir="$FAKE_DIR"
n=0
while [ -e "$dir/calls/$n.argv" ]; do n=$((n + 1)); done
printf '%s\\n' "$@" > "$dir/calls/$n.argv"
if [ -t 0 ]; then : > "$dir/calls/$n.stdin"; else cat > "$dir/calls/$n.stdin"; fi
if [ -f "$dir/stdout" ]; then cat "$dir/stdout"; fi
if [ -f "$dir/exit" ]; then exit "$(cat "$dir/exit")"; fi
exit 0
`;

let fakeDir: string;
let fakeCli: string;
let originalEnv: NodeJS.ProcessEnv;

async function calls(): Promise<{ args: string[]; stdin: string }[]> {
  const names = (await readdir(join(fakeDir, "calls"))).filter((name) => name.endsWith(".argv"));
  const indexes = names.map((name) => Number.parseInt(name, 10)).sort((a, b) => a - b);
  return Promise.all(
    indexes.map(async (index) => ({
      args: (await readFile(join(fakeDir, "calls", `${index}.argv`), "utf8"))
        .split("\n")
        .slice(0, -1),
      stdin: await readFile(join(fakeDir, "calls", `${index}.stdin`), "utf8"),
    })),
  );
}

function spec(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    currentPane: { env: "MYTTY_PANE_ID" },
    paneExists: [fakeCli, "exists", "{pane}"],
    focus: [fakeCli, "focus", "{pane}"],
    sendText: { argv: [fakeCli, "send", "--pane", "{pane}"], stdin: true },
    sendKey: [fakeCli, "key", "--pane={pane}", "{key}"],
    ...overrides,
  };
}

beforeEach(async () => {
  conf.clear();
  originalEnv = { ...process.env };
  fakeDir = await mkdtemp(join(tmpdir(), "editprompt-command-"));
  await mkdir(join(fakeDir, "calls"));
  fakeCli = join(fakeDir, "mytty");
  await writeFile(fakeCli, FAKE_CLI);
  await chmod(fakeCli, 0o755);
  process.env.FAKE_DIR = fakeDir;
});

afterEach(async () => {
  process.env = originalEnv;
  await rm(fakeDir, { recursive: true, force: true });
});

describe("command backend transport", () => {
  test("fills placeholders and runs commands without a shell", async () => {
    const backend = createCommandBackend("mytty", spec());
    const key = "it's $(whoami)";

    await backend.focusPane("pane 1");
    await backend.sendKey("pane 1", key);

    expect(await calls()).toEqual([
      { args: ["focus", "pane 1"], stdin: "" },
      { args: ["key", "--pane=pane 1", key], stdin: "" },
    ]);
  });

  test("sends text on stdin in chunks", async () => {
    const backend = createCommandBackend("mytty", spec({ maxChunkBytes: 4 }));

    await sendContentToPane(backend, "1", "abcdefg");

    expect(await calls()).toEqual([
      { args: ["send", "--pane", "1"], stdin: "abcd" },
      { args: ["send", "--pane", "1"], stdin: "efg" },
    ]);
  });

  test("passes text as an argument when sendText uses {text}", async () => {
    const backend = createCommandBackend("mytty", spec({ sendText: [fakeCli, "type", "{text}"] }));

    await backend.sendText("1", "hello world");

    expect(await calls()).toEqual([{ args: ["type", "hello world"], stdin: "" }]);
  });

  test("reads the current pane from an environment variable or a command", async () => {
    process.env.MYTTY_PANE_ID = " 7 ";
    expect(await createCommandBackend("mytty", spec()).getCurrentPaneId()).toBe("7");

    delete process.env.MYTTY_PANE_ID;
    expect(createCommandBackend("mytty", spec()).getCurrentPaneId()).rejects.toThrow(
      "MYTTY_PANE_ID is not set",
    );

    await writeFile(join(fakeDir, "stdout"), "42\n");
    const backend = createCommandBackend("mytty", spec({ currentPane: [fakeCli, "current"] }));
    expect(await backend.getCurrentPaneId()).toBe("42");
  });

  test("checks pane existence by exit status", async () => {
    const backend = createCommandBackend("mytty", spec());
    expect(await backend.paneExists("1")).toBe(true);

    await writeFile(join(fakeDir, "exit"), "1");
    expect(await backend.paneExists("1")).toBe(false);

    const missing = createCommandBackend("mytty", spec({ paneExists: ["/nonexistent/cli"] }));
    expect(await missing.paneExists("1")).toBe(false);
  });

  test("reports which command failed and why", async () => {
    await writeFile(join(fakeDir, "exit"), "3");
    const backend = createCommandBackend("mytty", spec());

    expect(backend.focusPane("1")).rejects.toThrow(`${fakeCli} focus 1 exited with 3`);
  });

  test("detects its environment from the configured variable", () => {
    const backend = createCommandBackend("mytty", spec({ detect: { env: "MYTTY_PANE_ID" } }));

    expect(backend.detect?.({ MYTTY_PANE_ID: "1" })).toBe(true);
    expect(backend.detect?.({ MYTTY_PANE_ID: " " })).toBe(false);
    expect(backend.detect?.({})).toBe(false);
  });

  test("uses defaults for the behavior knobs", () => {
    const backend = createCommandBackend("mytty", spec());

    expect(backend.maxChunkBytes).toBe(8192);
    expect(backend.defaultSubmitKey).toBe("Enter");
    expect(backend.quoteSeparator).toBe("\n\n");
    expect(backend.collectInput).toBe("argument");
    expect(canSplitPane(backend)).toBe(false);
  });

  test("keeps its state in Conf under its own namespace", async () => {
    const backend = createCommandBackend("mytty", spec());

    await markAsEditorPane(backend, "2", ["1"]);

    expect(backend.storageNamespace()).toBe("state.mytty");
    expect(conf.get("state.mytty.editorPane.pane_2")).toEqual({ targetPaneIds: ["1"] });
    expect(conf.get("state.mytty.targetPane.pane_1")).toEqual({ editorPaneId: "2" });
  });
});

describe("command backend pane management", () => {
  test("splits, runs a command in and closes panes", async () => {
    await writeFile(join(fakeDir, "stdout"), "9\n");
    const backend = createCommandBackend(
      "mytty",
      spec({
        splitPane: [fakeCli, "split", "{pane}", "--rows={rows}", "--cwd={cwd}"],
        runInPane: [fakeCli, "run", "{pane}", "exec {command}"],
        closePane: [fakeCli, "close", "{pane}"],
      }),
    );
    if (!canSplitPane(backend)) {
      throw new Error("expected a split-capable backend");
    }

    expect(await backend.splitPane("1", { rows: 12, cwd: "/repo", env: {} })).toBe("9");
    await backend.runInPane("9", ["/usr/bin/node", "/path with spaces/index.js", "open"]);
    await backend.closePane("9");

    expect((await calls()).map((call) => call.args)).toEqual([
      ["split", "1", "--rows=12", "--cwd=/repo"],
      ["run", "9", "exec '/usr/bin/node' '/path with spaces/index.js' 'open'"],
      ["close", "9"],
    ]);
  });
});

describe("command backend validation", () => {
  function errorOf(name: string, value: unknown): string {
    try {
      createCommandBackend(name, value);
    } catch (error) {
      expect(error).toBeInstanceOf(CommandBackendConfigError);
      return (error as Error).message;
    }
    throw new Error("expected a validation error");
  }

  test("requires the transport commands", () => {
    expect(errorOf("mytty", {}).split("\n")).toEqual([
      "backends.mytty.currentPane is required",
      "backends.mytty.paneExists is required",
      "backends.mytty.focus is required",
      "backends.mytty.sendText is required",
      "backends.mytty.sendKey is required",
    ]);
  });

  test("rejects unknown options, placeholders and malformed commands", () => {
    const message = errorOf(
      "mytty",
      spec({
        focs: ["x"],
        focus: ["x", "{key}"],
        sendKey: "x {key}",
        sendText: { argv: ["x"], stdin: "yes", shell: true },
        collectInput: "clipboard",
        maxChunkBytes: 0,
      }),
    );

    expect(message.split("\n")).toEqual([
      "backends.mytty.focs is not a known option",
      "backends.mytty.focus uses an unknown placeholder {key} (allowed: {pane})",
      "backends.mytty.sendText.stdin must be a boolean",
      "backends.mytty.sendText.shell is not a known option",
      'backends.mytty.sendKey must be a non-empty array of strings or { "argv": [...] }',
      "backends.mytty.maxChunkBytes must be an integer of at least 4",
      'backends.mytty.collectInput must be "stdin" or "argument"',
    ]);
  });

  test("rejects functions, so only declarative configuration is accepted", () => {
    expect(errorOf("mytty", spec({ focus: () => {} }))).toBe(
      'backends.mytty.focus must be a non-empty array of strings or { "argv": [...] }',
    );
  });

  test("requires the pane management commands together", () => {
    expect(errorOf("mytty", spec({ splitPane: ["x"] }))).toBe(
      "backends.mytty: splitPane, runInPane and closePane must be set together",
    );
  });

  test("rejects names that are not plain identifiers", () => {
    expect(errorOf("my tty", spec())).toBe(
      'backends.my tty: the name may only contain letters, digits, "-" and "_"',
    );
  });
});
