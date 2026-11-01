import { spawn } from "node:child_process";
import { join } from "node:path";
import { getLogger } from "@logtape/logtape";
import { REX_SEND_CHUNK_BYTES } from "../config/constants";
import { splitByByteSize } from "../utils/contentChunker";
import { conf } from "./conf";

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

// Every Rex block ID is a `block:<uuid>`, unique across the server, so the keys
// need no session namespace the way Herdr's do.
function targetPaneKey(paneId: string): string {
  return `rex.targetPane.pane_${paneId}`;
}

function editorPaneKey(paneId: string): string {
  return `rex.editorPane.pane_${paneId}`;
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

export async function saveEditorPaneId(targetPaneId: string, editorPaneId: string): Promise<void> {
  const data = conf.get(targetPaneKey(targetPaneId));
  const existing = typeof data === "object" && data !== null ? data : {};
  conf.set(targetPaneKey(targetPaneId), {
    ...existing,
    editorPaneId,
  });
}

export async function getEditorPaneId(targetPaneId: string): Promise<string> {
  const data = conf.get(targetPaneKey(targetPaneId));
  if (typeof data === "object" && data !== null && "editorPaneId" in data) {
    return String(data.editorPaneId);
  }
  return "";
}

export async function clearEditorPaneId(targetPaneId: string): Promise<void> {
  const editorPaneId = await getEditorPaneId(targetPaneId);

  const data = conf.get(targetPaneKey(targetPaneId));
  if (typeof data === "object" && data !== null && "editorPaneId" in data) {
    const { editorPaneId: _, ...remaining } = data;
    if (Object.keys(remaining).length === 0) {
      conf.delete(targetPaneKey(targetPaneId));
    } else {
      conf.set(targetPaneKey(targetPaneId), remaining);
    }
  }
  if (editorPaneId) {
    conf.delete(editorPaneKey(editorPaneId));
  }
}

export async function markAsEditorPane(
  editorPaneId: string,
  targetPaneIds: string[],
): Promise<void> {
  const uniqueTargetPaneIds = [...new Set(targetPaneIds)];
  conf.set(editorPaneKey(editorPaneId), {
    targetPaneIds: uniqueTargetPaneIds,
  });
  // Save editor pane ID to each target pane
  for (const targetPaneId of uniqueTargetPaneIds) {
    await saveEditorPaneId(targetPaneId, editorPaneId);
  }
}

export async function getTargetPaneIds(editorPaneId: string): Promise<string[]> {
  const data = conf.get(editorPaneKey(editorPaneId));
  if (typeof data === "object" && data !== null && "targetPaneIds" in data) {
    const targetPaneIds = data.targetPaneIds;
    if (Array.isArray(targetPaneIds)) {
      return targetPaneIds.map((id) => String(id));
    }
  }
  return [];
}

export function isEditorPaneFromConf(paneId: string): boolean {
  return conf.has(editorPaneKey(paneId));
}

// Focus switching for the resume mode, in one call so that resume.ts does not
// need a fifth copy of the same branch. From an editor pane, focus the first
// target pane that is still alive; from a target pane, focus its editor pane.
// Returns false when there is nothing to switch to, which is resume's signal to
// let the caller open a new editor pane instead.
export async function resumeEditorPane(targetPaneId: string): Promise<boolean> {
  const currentPaneId = await getCurrentPaneId();
  const editorPaneId = isEditorPaneFromConf(currentPaneId)
    ? currentPaneId
    : isEditorPaneFromConf(targetPaneId)
      ? targetPaneId
      : "";

  if (editorPaneId) {
    const targetPaneIds = await getTargetPaneIds(editorPaneId);
    for (const paneId of targetPaneIds) {
      if (await checkPaneExists(paneId)) {
        await focusPane(paneId);
        return true;
      }
    }
    return false;
  }

  const registeredEditorPaneId = await getEditorPaneId(targetPaneId);
  if (registeredEditorPaneId === "") {
    return false;
  }
  if (!(await checkPaneExists(registeredEditorPaneId))) {
    await clearEditorPaneId(targetPaneId);
    return false;
  }

  await focusPane(registeredEditorPaneId);
  return true;
}

export async function appendToQuoteText(paneId: string, content: string): Promise<void> {
  const data = conf.get(targetPaneKey(paneId));
  const existing = typeof data === "object" && data !== null ? data : {};
  const existingQuoteText = "quote_text" in existing ? String(existing.quote_text) : "";
  const quoteText =
    existingQuoteText.trim() !== "" ? `${existingQuoteText}\n\n${content}` : content;

  conf.set(targetPaneKey(paneId), {
    ...existing,
    quote_text: quoteText,
  });
}

export async function getQuoteText(paneId: string): Promise<string> {
  const data = conf.get(targetPaneKey(paneId));
  if (typeof data === "object" && data !== null && "quote_text" in data) {
    return String(data.quote_text);
  }
  return "";
}

export async function clearQuoteText(paneId: string): Promise<void> {
  const data = conf.get(targetPaneKey(paneId));
  if (typeof data === "object" && data !== null && "quote_text" in data) {
    const { quote_text: _, ...remaining } = data;
    if (Object.keys(remaining).length === 0) {
      conf.delete(targetPaneKey(paneId));
    } else {
      conf.set(targetPaneKey(paneId), remaining);
    }
  }
}

export async function inputToRexPane(paneId: string, content: string): Promise<void> {
  // Split long content into chunks to stay under the control API's request
  // limit, then send each chunk in order (no focus change). The --auto-send
  // Enter is sent separately by the caller after all chunks, so it fires only
  // once.
  const chunks = splitByByteSize(content, REX_SEND_CHUNK_BYTES);
  for (const chunk of chunks) {
    await runRex(["send", "-b", paneId], chunk);
  }
  logger.debug("Content sent to Rex pane: {paneId} ({chunks} chunk(s))", {
    paneId,
    chunks: chunks.length,
  });
}

export async function sendKeyToRexPane(paneId: string, key: string, delay = 1000): Promise<void> {
  // Sleep so as not to be treated as a newline (e.g., codex)
  await new Promise((resolve) => setTimeout(resolve, delay));
  await runRex(["send-key", "-b", paneId, key]);
}
