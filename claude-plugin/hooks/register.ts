import type { EngineInterface, Register } from "claude-code";

/**
 * Keeps Claude Code's prompt suggestion in editprompt, so that the editor pane
 * can read it with `editprompt suggestion get`.
 *
 * editprompt finds the target pane and the backend from the environment that
 * Claude Code runs in, the same way as `collect`.
 */

let command = ["editprompt"];
let hasWarned = false;

async function runSuggestion($: EngineInterface, args: string[]): Promise<void> {
  try {
    const { exitCode, stderr } = await $.process.run([...command, "suggestion", ...args]);
    if (exitCode !== 0) {
      throw new Error(stderr.trim() || `exit code ${exitCode}`);
    }
  } catch (error) {
    // Warn once per load, not on every turn.
    if (!hasWarned) {
      hasWarned = true;
      $.ui.toast(`editprompt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const register: Register = (on, options) => {
  command = String(options.command ?? "editprompt")
    .split(/\s+/)
    .filter((word) => word !== "");

  on("prompt.suggest", { origin: { kind: "suggestion" } }, async ($, e, next) => {
    const result = await next(e);
    if (result.isShown) {
      await runSuggestion($, ["set", "--", e.text]);
    }
    return result;
  });

  // A suggestion only fits the prompt it was made for. Clearing it does not hold
  // up the submit.
  on("prompt.submit", ($, e, next) => {
    void runSuggestion($, ["clear"]);
    return next(e);
  });
};
