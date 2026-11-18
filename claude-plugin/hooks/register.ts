import type { EngineInterface, Register } from "claude-code";

/**
 * Lets the editor pane pull what is in Claude Code's prompt box with
 * `editprompt pull`: the draft, or the prompt suggestion when nothing is typed.
 *
 * The plugin runs `editprompt bridge` for the life of the session. The bridge
 * writes one JSON line per event to stdout; each pull is answered by POSTing
 * the result back to the bridge's socket. editprompt finds the target pane and
 * the backend from the environment that Claude Code runs in, the same way as
 * `collect`.
 */

type BridgeEvent =
  | { type: "ready"; socketPath: string }
  | { type: "pull"; id: number; keep: boolean };

interface PullResult {
  text: string;
  source: "draft" | "suggestion" | "none";
  isCleared: boolean;
}

let command = ["editprompt"];
let hasWarned = false;
let socketPath = "";
// The suggestion shown in the empty prompt box, kept until the next submit.
let suggestion = "";

const LOG_FILE_NAME = "error.log";
// Keep the newest lines only, so the file does not grow without bound.
const MAX_LOG_LINES = 500;

/** Appends the failure to the log file in the plugin's data folder and returns its path. */
async function writeErrorLog($: EngineInterface, message: string): Promise<string | undefined> {
  try {
    const dataDir = (await $.process.hookEnv()).CLAUDE_PLUGIN_DATA;
    if (dataDir === undefined || dataDir === "") {
      return undefined;
    }
    const path = `${dataDir}/${LOG_FILE_NAME}`;
    const previous = await $.fs.read(path).catch(() => "");
    const entry = `[${new Date().toISOString()}] ${message}\n`;
    const lines = `${previous}${entry}`.split("\n");
    await $.fs.write(path, lines.slice(-MAX_LOG_LINES).join("\n"));
    return path;
  } catch {
    return undefined;
  }
}

/**
 * Logs `detail` (the whole error, `summary` when left out) and shows `summary`
 * in a toast. The toast is gone quickly, so it points to the log for the rest.
 */
async function warn($: EngineInterface, summary: string, detail = summary): Promise<void> {
  const logPath = await writeErrorLog($, detail);
  // Warn once per load, not on every pull.
  if (!hasWarned) {
    hasWarned = true;
    $.ui.toast(`editprompt: ${summary}${logPath ? ` (see ${logPath})` : ""}`, {
      timeoutMs: 10000,
    });
  }
}

/**
 * Expands a leading `~` in each word to the home directory, as a shell would,
 * so that the `command` option can be shared between machines.
 */
async function expandHome($: EngineInterface, words: string[]): Promise<string[]> {
  const home = await $.env.get("HOME");
  if (home === undefined || home === "") {
    return words;
  }
  return words.map((word) =>
    word === "~" || word.startsWith("~/") ? `${home}${word.slice(1)}` : word,
  );
}

async function answerPull($: EngineInterface, id: number, keep: boolean): Promise<void> {
  const box = await $.prompt.read();
  let result: PullResult;
  if (box.text !== "") {
    const isCleared = keep ? false : (await $.prompt.fill({ text: "", mode: "replace" })).isFilled;
    result = { text: box.text, source: "draft", isCleared };
  } else {
    result = {
      text: suggestion,
      source: suggestion === "" ? "none" : "suggestion",
      isCleared: false,
    };
  }
  await $.http.fetch(`http://editprompt/pull/${id}`, {
    method: "POST",
    socketPath,
    body: JSON.stringify(result),
  });
}

function handleEvent($: EngineInterface, line: string): void {
  const event = JSON.parse(line) as BridgeEvent;
  if (event.type === "ready") {
    socketPath = event.socketPath;
    return;
  }
  void answerPull($, event.id, event.keep).catch((error: unknown) => {
    void warn($, error instanceof Error ? error.message : String(error));
  });
}

async function runBridge($: EngineInterface): Promise<void> {
  let argv = [...command, "bridge"];
  let stdout = "";
  let stderr = "";
  try {
    argv = [...(await expandHome($, command)), "bridge"];
    const bridge = $.process.spawn({ argv });
    const iterator = bridge[Symbol.asyncIterator]();
    for (;;) {
      const step = await iterator.next();
      if (step.done) {
        if (step.value.code !== 0 && step.value.code !== null) {
          const exited = `bridge exited with ${step.value.code}`;
          const lines = stderr.trim().split("\n");
          await warn(
            $,
            lines[lines.length - 1] || exited,
            `${argv.join(" ")}: ${exited}\n${stderr.trim()}`,
          );
        }
        return;
      }
      if (step.value.stream === "stderr") {
        stderr += step.value.text;
        continue;
      }
      stdout += step.value.text;
      let index: number;
      while ((index = stdout.indexOf("\n")) >= 0) {
        handleEvent($, stdout.slice(0, index));
        stdout = stdout.slice(index + 1);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await warn($, message, `${argv.join(" ")}: ${message}`);
  }
}

export const register: Register = (on, options) => {
  command = String(options.command ?? "editprompt")
    .split(/\s+/)
    .filter((word) => word !== "");

  on("session.start", async ($, e, next) => {
    const started = await next(e);
    void runBridge($);
    return started;
  });

  on("prompt.suggest", { origin: { kind: "suggestion" } }, async ($, e, next) => {
    const result = await next(e);
    if (result.isShown) {
      suggestion = e.text;
    }
    return result;
  });

  // A suggestion only fits the prompt it was made for.
  on("prompt.submit", ($, e, next) => {
    suggestion = "";
    return next(e);
  });
};
