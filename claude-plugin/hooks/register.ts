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

function warn($: EngineInterface, message: string): void {
  // Warn once per load, not on every pull.
  if (!hasWarned) {
    hasWarned = true;
    $.ui.toast(`editprompt: ${message}`);
  }
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
    warn($, error instanceof Error ? error.message : String(error));
  });
}

async function runBridge($: EngineInterface): Promise<void> {
  const bridge = $.process.spawn({ argv: [...command, "bridge"] });
  const iterator = bridge[Symbol.asyncIterator]();
  let stdout = "";
  let stderr = "";
  try {
    for (;;) {
      const step = await iterator.next();
      if (step.done) {
        if (step.value.code !== 0 && step.value.code !== null) {
          const lines = stderr.trim().split("\n");
          warn($, lines[lines.length - 1] || `bridge exited with ${step.value.code}`);
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
    warn($, error instanceof Error ? error.message : String(error));
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
