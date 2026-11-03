import { spawn } from "node:child_process";
import { join } from "node:path";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["editprompt", "rex"]);

const REX_COMMAND = "rex";

// Autostart is off everywhere: these calls only ever act on blocks that already
// exist, so a missing server means the panes are gone, not that one should be
// started.
const REX_GLOBAL_ARGS = ["--autostart=false"];

// Rex sets REX_BIN_DIR in the terminals it opens and its own CLI lives there,
// so that is the copy Rex means for them to use. Prefer it over a PATH lookup:
// a terminal that Rex's configuration file starts runs the login shell's
// environment but not its interactive configuration, and that shell may
// rebuild PATH without the directory Rex added, as it does on NixOS and
// nix-darwin, leaving no `rex` to find at all.
function rexCommand(): string {
  const binDir = process.env.REX_BIN_DIR?.trim();
  return binDir ? join(binDir, REX_COMMAND) : REX_COMMAND;
}

// No session scope: a block ID is unique across the server, so Rex resolves one
// without it, and `register --target-pane` may name a pane in another session,
// which a scope would hide.
function rexArgs(args: string[]): string[] {
  return [...REX_GLOBAL_ARGS, ...args];
}

// `rex send` takes its text on stdin, which keeps it out of the argument list
// and so out of reach of ARG_MAX; it still has to be chunked for the control
// API's own limit, see REX_SEND_CHUNK_BYTES. Every other call passes no input,
// and leaving their stdin closed means a wrong argv fails instead of waiting
// for input that never comes.
function runRex(args: string[], input?: string): Promise<string> {
  const command = rexCommand();
  const argv = rexArgs(args);
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, {
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      reject(new Error(`Failed to run rex: ${error.message}`));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`rex ${argv.join(" ")} exited with ${code}: ${stderr.trim()}`));
    });

    if (input !== undefined) {
      if (!child.stdin) {
        reject(new Error("rex was started without a standard input to write to"));
        return;
      }
      child.stdin.on("error", (error) => {
        reject(new Error(`Failed to write to rex: ${error.message}`));
      });
      child.stdin.end(input);
    }
  });
}

export async function getCurrentPaneId(): Promise<string> {
  const paneId = process.env.REX_BLOCK?.trim();
  if (!paneId) {
    throw new Error("REX_BLOCK is not set");
  }
  return paneId;
}

export async function checkPaneExists(paneId: string): Promise<boolean> {
  try {
    await runRex(["block", "inspect", paneId, "--json"]);
    return true;
  } catch (error) {
    logger.debug("checkPaneExists failed: {error}", { error });
    return false;
  }
}

export async function focusPane(paneId: string): Promise<void> {
  await runRex(["block", "focus", paneId]);
}

export async function sendTextChunk(paneId: string, chunk: string): Promise<void> {
  await runRex(["send", "-b", paneId], chunk);
}

export async function sendKey(paneId: string, key: string): Promise<void> {
  await runRex(["send-key", "-b", paneId, key]);
}
