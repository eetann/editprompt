import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REX_SEND_CHUNK_BYTES } from "../../src/config/constants";
import { conf } from "../../src/modules/conf";
import {
  appendToQuoteText,
  checkPaneExists,
  clearEditorPaneId,
  clearQuoteText,
  focusPane,
  getCurrentPaneId,
  getEditorPaneId,
  getQuoteText,
  getTargetPaneIds,
  inputToRexPane,
  isEditorPaneFromConf,
  markAsEditorPane,
  resumeEditorPane,
  sendKeyToRexPane,
} from "../../src/modules/rex";

const SESSION = "session:01a18b8b-f941-77a1-a135-5b96ea5827fb";
const EDITOR_PANE = "block:01a18b8b-f942-717a-b4c5-f2f397bf64cb";
const TARGET_PANE = "block:01a18b8c-4c15-7bea-baff-f9b23870c685";

// The Rex backend shells out to the `rex` CLI, so the tests put a fake one on
// the PATH. It records each invocation's arguments and standard input, and
// reads its exit status from a file so a test can make a command fail the way
// the real CLI does, which is with status 3.
const FAKE_REX = `#!/bin/sh
dir="$REX_FAKE_DIR"
n=0
while [ -e "$dir/calls/$n.argv" ]; do n=$((n + 1)); done
printf '%s\\n' "$@" > "$dir/calls/$n.argv"
cat > "$dir/calls/$n.stdin"
if [ -f "$dir/exit" ]; then
  exit "$(cat "$dir/exit")"
fi
exit 0
`;

interface Call {
  args: string[];
  stdin: string;
}

let fakeDir: string;
let originalEnv: NodeJS.ProcessEnv;

async function calls(): Promise<Call[]> {
  const names = (await readdir(join(fakeDir, "calls"))).filter((name) => name.endsWith(".argv"));
  const indexes = names.map((name) => Number.parseInt(name, 10)).sort((a, b) => a - b);
  return Promise.all(
    indexes.map(async (index) => {
      const argv = await readFile(join(fakeDir, "calls", `${index}.argv`), "utf8");
      const stdin = await readFile(join(fakeDir, "calls", `${index}.stdin`), "utf8");
      // The fake writes one argument per line, so the trailing newline leaves
      // an empty final element.
      return { args: argv.split("\n").slice(0, -1), stdin };
    }),
  );
}

async function failNextCalls(status = 3): Promise<void> {
  await writeFile(join(fakeDir, "exit"), String(status));
}

beforeEach(async () => {
  conf.clear();
  originalEnv = { ...process.env };
  fakeDir = await mkdtemp(join(tmpdir(), "editprompt-rex-"));
  await mkdir(join(fakeDir, "calls"));
  const binDir = join(fakeDir, "bin");
  await mkdir(binDir);
  await writeFile(join(binDir, "rex"), FAKE_REX);
  await chmod(join(binDir, "rex"), 0o755);

  process.env.PATH = `${binDir}:${process.env.PATH}`;
  delete process.env.REX_BIN_DIR;
  process.env.REX_FAKE_DIR = fakeDir;
  process.env.REX_SESSION = SESSION;
  process.env.REX_BLOCK = EDITOR_PANE;
});

afterEach(async () => {
  process.env = originalEnv;
  await rm(fakeDir, { recursive: true, force: true });
});

describe("Rex pane API", () => {
  test("gets the current pane ID from a Rex block environment", async () => {
    expect(await getCurrentPaneId()).toBe(EDITOR_PANE);
  });

  test("throws when the current pane ID is unavailable", async () => {
    delete process.env.REX_BLOCK;
    await expect(getCurrentPaneId()).rejects.toThrow("REX_BLOCK is not set");

    process.env.REX_BLOCK = "  ";
    await expect(getCurrentPaneId()).rejects.toThrow("REX_BLOCK is not set");
  });

  test("checks pane existence through block inspect", async () => {
    expect(await checkPaneExists(TARGET_PANE)).toBe(true);

    const [call] = await calls();
    expect(call?.args).toEqual(["--autostart=false", "block", "inspect", TARGET_PANE, "--json"]);
  });

  test("returns false when the block is not found", async () => {
    await failNextCalls();
    expect(await checkPaneExists(TARGET_PANE)).toBe(false);
  });

  test("focuses a pane through block focus", async () => {
    await focusPane(TARGET_PANE);

    const [call] = await calls();
    expect(call?.args).toEqual(["--autostart=false", "block", "focus", TARGET_PANE]);
  });

  test("runs the CLI from REX_BIN_DIR when Rex provides one", async () => {
    // Rex sets REX_BIN_DIR in the terminals it opens, and a terminal its
    // configuration file starts can have a PATH without that directory.
    const binDir = join(fakeDir, "rex-bin");
    await mkdir(binDir);
    await writeFile(join(binDir, "rex"), FAKE_REX);
    await chmod(join(binDir, "rex"), 0o755);
    process.env.REX_BIN_DIR = binDir;
    process.env.PATH = "/usr/bin:/bin";

    await focusPane(TARGET_PANE);

    expect(await calls()).toHaveLength(1);
  });

  test("never asks the CLI to autostart a server", async () => {
    await focusPane(TARGET_PANE);
    await sendKeyToRexPane(TARGET_PANE, "enter", 0);
    await inputToRexPane(TARGET_PANE, "hello");

    for (const call of await calls()) {
      expect(call.args).toContain("--autostart=false");
    }
  });

  test("never scopes a command to a session", async () => {
    // A block ID is unique across the server, and `register --target-pane` may
    // name a pane in another session, which a session scope would hide.
    await focusPane(TARGET_PANE);

    const [call] = await calls();
    expect(call?.args).not.toContain("-s");
    expect(call?.args).not.toContain(SESSION);
  });

  test("sends text on standard input without shell escaping", async () => {
    const content = `it's "quoted" $(whoami) \`id\` ;rm -rf / \\n`;
    await inputToRexPane(TARGET_PANE, content);

    const [call] = await calls();
    expect(call?.args).toEqual(["--autostart=false", "send", "-b", TARGET_PANE]);
    expect(call?.stdin).toBe(content);
  });

  test("splits text across requests below the control API's limit", async () => {
    const content = "a".repeat(REX_SEND_CHUNK_BYTES + 100);
    await inputToRexPane(TARGET_PANE, content);

    const sent = await calls();
    expect(sent).toHaveLength(2);
    expect(sent[0]?.stdin.length).toBe(REX_SEND_CHUNK_BYTES);
    expect(sent.map((call) => call.stdin).join("")).toBe(content);
  });

  test("reports which command failed and why", async () => {
    await failNextCalls();
    await expect(inputToRexPane(TARGET_PANE, "hello")).rejects.toThrow("exited with 3");
  });

  test("sends a key through send-key", async () => {
    await sendKeyToRexPane(TARGET_PANE, "enter", 0);

    const [call] = await calls();
    expect(call?.args).toEqual(["--autostart=false", "send-key", "-b", TARGET_PANE, "enter"]);
  });
});

describe("Rex editor state", () => {
  test("registers an editor pane with unique target panes", async () => {
    await markAsEditorPane(EDITOR_PANE, [TARGET_PANE, TARGET_PANE]);

    expect(isEditorPaneFromConf(EDITOR_PANE)).toBe(true);
    expect(isEditorPaneFromConf(TARGET_PANE)).toBe(false);
    expect(await getTargetPaneIds(EDITOR_PANE)).toEqual([TARGET_PANE]);
    expect(await getEditorPaneId(TARGET_PANE)).toBe(EDITOR_PANE);
  });

  test("clears editor state while preserving quote text", async () => {
    await markAsEditorPane(EDITOR_PANE, [TARGET_PANE]);
    await appendToQuoteText(TARGET_PANE, "> foo\n\n");

    await clearEditorPaneId(TARGET_PANE);

    expect(await getEditorPaneId(TARGET_PANE)).toBe("");
    expect(isEditorPaneFromConf(EDITOR_PANE)).toBe(false);
    expect(await getQuoteText(TARGET_PANE)).toBe("> foo\n\n");
  });

  test("appends and clears quote text while preserving editor state", async () => {
    await markAsEditorPane(EDITOR_PANE, [TARGET_PANE]);
    await appendToQuoteText(TARGET_PANE, "> foo");
    await appendToQuoteText(TARGET_PANE, "> bar");

    expect(await getQuoteText(TARGET_PANE)).toBe("> foo\n\n> bar");

    await clearQuoteText(TARGET_PANE);

    expect(await getQuoteText(TARGET_PANE)).toBe("");
    expect(await getEditorPaneId(TARGET_PANE)).toBe(EDITOR_PANE);
  });

  test("resumes the editor pane from its target pane", async () => {
    await markAsEditorPane(EDITOR_PANE, [TARGET_PANE]);
    process.env.REX_BLOCK = TARGET_PANE;

    expect(await resumeEditorPane(TARGET_PANE)).toBe(true);

    const focused = (await calls()).filter((call) => call.args.includes("focus"));
    expect(focused).toHaveLength(1);
    expect(focused[0]?.args.at(-1)).toBe(EDITOR_PANE);
  });

  test("resumes back to the target pane from the editor pane", async () => {
    await markAsEditorPane(EDITOR_PANE, [TARGET_PANE]);

    expect(await resumeEditorPane(TARGET_PANE)).toBe(true);

    const focused = (await calls()).filter((call) => call.args.includes("focus"));
    expect(focused).toHaveLength(1);
    expect(focused[0]?.args.at(-1)).toBe(TARGET_PANE);
  });

  test("forgets an editor pane that no longer exists", async () => {
    await markAsEditorPane(EDITOR_PANE, [TARGET_PANE]);
    process.env.REX_BLOCK = TARGET_PANE;
    await failNextCalls();

    expect(await resumeEditorPane(TARGET_PANE)).toBe(false);
    expect(await getEditorPaneId(TARGET_PANE)).toBe("");
  });

  test("returns false when no editor pane is registered", async () => {
    expect(await resumeEditorPane(TARGET_PANE)).toBe(false);
    expect(await calls()).toHaveLength(0);
  });
});
