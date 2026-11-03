import { createHash } from "node:crypto";
import { createConnection } from "node:net";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["editprompt", "herdr"]);
const HERDR_REQUEST_TIMEOUT_MS = 6_000;
let requestSequence = 0;

interface HerdrError {
  code: string;
  message: string;
}

interface HerdrResponse {
  id: string;
  result?: unknown;
  error?: HerdrError;
}

interface HerdrPaneLayoutResult {
  layout?: {
    panes?: Array<{
      pane_id?: unknown;
      rect?: {
        height?: unknown;
      };
    }>;
  };
}

interface HerdrPaneInfoResult {
  pane?: {
    pane_id?: unknown;
  };
}

function getSocketPath(): string {
  const socketPath = process.env.HERDR_SOCKET_PATH?.trim();
  if (!socketPath) {
    throw new Error("HERDR_SOCKET_PATH is not set");
  }
  return socketPath;
}

async function sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
  const id = `editprompt_${process.pid}_${++requestSequence}`;
  const request = `${JSON.stringify({ id, method, params })}\n`;

  return new Promise((resolve, reject) => {
    const socket = createConnection(getSocketPath());
    let buffer = "";
    let settled = false;

    const finish = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      socket.end();
      callback();
    };

    socket.setEncoding("utf8");
    socket.setTimeout(HERDR_REQUEST_TIMEOUT_MS);
    socket.on("connect", () => {
      socket.write(request);
    });
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) {
        return;
      }

      const line = buffer.slice(0, newlineIndex);
      let response: HerdrResponse;
      try {
        response = JSON.parse(line) as HerdrResponse;
      } catch (error) {
        finish(() => {
          reject(
            new Error(
              `Invalid response from Herdr: ${error instanceof Error ? error.message : "Unknown error"}`,
            ),
          );
        });
        return;
      }

      if (response.id !== id) {
        finish(() => {
          reject(new Error(`Unexpected response ID from Herdr: ${response.id}`));
        });
        return;
      }
      if (response.error) {
        finish(() => {
          reject(new Error(`Herdr ${response.error?.code}: ${response.error?.message}`));
        });
        return;
      }

      finish(() => {
        resolve(response.result);
      });
    });
    socket.on("error", (error) => {
      finish(() => {
        reject(new Error(`Failed to communicate with Herdr: ${error.message}`));
      });
    });
    socket.on("timeout", () => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      reject(new Error(`Timed out waiting for Herdr response after ${HERDR_REQUEST_TIMEOUT_MS}ms`));
    });
    socket.on("end", () => {
      if (!settled) {
        finish(() => {
          reject(new Error("Herdr closed the socket before sending a response"));
        });
      }
    });
  });
}

export function getStorageNamespace(): string {
  const sessionHash = createHash("sha256").update(getSocketPath()).digest("hex").slice(0, 16);
  return `herdr.session_${sessionHash}`;
}

export async function getCurrentPaneId(): Promise<string> {
  const paneId = process.env.HERDR_PANE_ID?.trim() || process.env.HERDR_ACTIVE_PANE_ID?.trim();
  if (!paneId) {
    throw new Error("HERDR_PANE_ID or HERDR_ACTIVE_PANE_ID is not set");
  }
  return paneId;
}

export async function checkPaneExists(paneId: string): Promise<boolean> {
  try {
    await sendRequest("pane.get", { pane_id: paneId });
    return true;
  } catch (error) {
    logger.debug("checkPaneExists failed: {error}", { error });
    return false;
  }
}

export async function focusPane(paneId: string): Promise<void> {
  await sendRequest("pane.focus", { pane_id: paneId });
}

export function calculateEditorSplitRatio(paneHeight: number, editorPaneRows: number): number {
  if (!Number.isInteger(paneHeight) || paneHeight <= 1) {
    throw new Error(`Invalid Herdr pane height: ${paneHeight}`);
  }
  if (!Number.isInteger(editorPaneRows) || editorPaneRows <= 0) {
    throw new Error(`Invalid Herdr editor pane rows: ${editorPaneRows}`);
  }

  return Math.min(0.9, Math.max(0.1, 1 - editorPaneRows / paneHeight));
}

export async function splitEditorPane(
  targetPaneId: string,
  editorPaneRows: number,
  cwd?: string,
  env: Record<string, string> = {},
): Promise<string> {
  const layoutResult = (await sendRequest("pane.layout", {
    pane_id: targetPaneId,
  })) as HerdrPaneLayoutResult;
  const targetPane = layoutResult.layout?.panes?.find((pane) => pane.pane_id === targetPaneId);
  const paneHeight = targetPane?.rect?.height;
  if (typeof paneHeight !== "number") {
    throw new Error(`Herdr pane.layout did not return a height for pane ${targetPaneId}`);
  }

  const ratio = calculateEditorSplitRatio(paneHeight, editorPaneRows);
  const params: Record<string, unknown> = {
    target_pane_id: targetPaneId,
    direction: "down",
    ratio,
    focus: true,
    env,
  };
  if (cwd?.trim()) {
    params.cwd = cwd;
  }

  const splitResult = (await sendRequest("pane.split", params)) as HerdrPaneInfoResult;
  const editorPaneId = splitResult.pane?.pane_id;
  if (typeof editorPaneId !== "string" || editorPaneId === "") {
    throw new Error("Herdr pane.split did not return the new pane ID");
  }
  return editorPaneId;
}

function quoteShellWord(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export async function runCommandInPane(paneId: string, argv: string[]): Promise<void> {
  if (argv.length === 0) {
    throw new Error("Cannot run an empty command in a Herdr pane");
  }
  const command = `exec ${argv.map(quoteShellWord).join(" ")}`;
  await sendRequest("pane.send_input", {
    pane_id: paneId,
    text: command,
    keys: ["Enter"],
  });
}

export async function closePane(paneId: string): Promise<void> {
  await sendRequest("pane.close", { pane_id: paneId });
}

export async function sendTextChunk(paneId: string, chunk: string): Promise<void> {
  await sendRequest("pane.send_text", { pane_id: paneId, text: chunk });
}

export async function sendKey(paneId: string, key: string): Promise<void> {
  await sendRequest("pane.send_keys", { pane_id: paneId, keys: [key] });
}
