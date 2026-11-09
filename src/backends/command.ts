import { spawn } from "node:child_process";
import { getLogger } from "@logtape/logtape";
import { confStore } from "./stores";
import { defineBackend, type MuxBackend } from "./types";

const logger = getLogger(["editprompt", "command-backend"]);

/**
 * A backend declared in the configuration file. Every operation is a shell
 * script run with `/bin/sh -c`. The values of the call are passed as
 * `EDITPROMPT_*` environment variables rather than pasted into the script, so
 * they never need quoting.
 */
export interface CommandBackendSpec {
  /** Selects this backend automatically when the environment variable is set. */
  detect?: { env: string };
  /** The pane editprompt runs in: read from an environment variable or a script's stdout. */
  currentPane: { env: string } | string;
  /** Exits 0 when `$EDITPROMPT_PANE` exists. */
  paneExists: string;
  /** Focuses `$EDITPROMPT_PANE`. */
  focus: string;
  /** Types the text it reads from stdin into `$EDITPROMPT_PANE`. */
  sendText: string;
  /** Sends `$EDITPROMPT_KEY` to `$EDITPROMPT_PANE`. */
  sendKey: string;
  /** Largest chunk of text passed to one sendText call. Default 8192. */
  maxChunkBytes?: number;
  /** Key sent by `input --auto-send`. Default "Enter". */
  submitKey?: string;
  /** Separator between quotes collected by `collect`. Default "\n\n". */
  quoteSeparator?: string;
  /** Where `collect` reads the selection from. Default "argument". */
  collectInput?: "stdin" | "argument";
  /** Splits a pane next to `$EDITPROMPT_PANE` with `$EDITPROMPT_ROWS` rows in `$EDITPROMPT_CWD`; prints the new pane ID. */
  splitPane?: string;
  /** Runs `$EDITPROMPT_COMMAND` (the shell-quoted editprompt command line) in `$EDITPROMPT_PANE`. */
  runInPane?: string;
  /** Closes `$EDITPROMPT_PANE`. */
  closePane?: string;
}

const COMMAND_VARIABLES = {
  currentPane: [],
  paneExists: ["EDITPROMPT_PANE"],
  focus: ["EDITPROMPT_PANE"],
  sendText: ["EDITPROMPT_PANE"],
  sendKey: ["EDITPROMPT_PANE", "EDITPROMPT_KEY"],
  splitPane: ["EDITPROMPT_PANE", "EDITPROMPT_ROWS", "EDITPROMPT_CWD"],
  runInPane: ["EDITPROMPT_PANE", "EDITPROMPT_COMMAND"],
  closePane: ["EDITPROMPT_PANE"],
} as const satisfies Record<string, readonly string[]>;

type CommandField = keyof typeof COMMAND_VARIABLES;
type CommandVariable = (typeof COMMAND_VARIABLES)[CommandField][number];
type CommandValues = Partial<Record<CommandVariable, string>>;

const COMMAND_VARIABLE_NAMES = new Set<string>(Object.values(COMMAND_VARIABLES).flat());

const REQUIRED_COMMANDS = ["paneExists", "focus", "sendText", "sendKey"] as const;
const OPTIONAL_COMMANDS = ["splitPane", "runInPane", "closePane"] as const;
const KNOWN_FIELDS = new Set<string>([
  "detect",
  "currentPane",
  ...REQUIRED_COMMANDS,
  ...OPTIONAL_COMMANDS,
  "maxChunkBytes",
  "submitKey",
  "quoteSeparator",
  "collectInput",
]);

const DEFAULT_MAX_CHUNK_BYTES = 8192;
const SHELL = "/bin/sh";
const VARIABLE_PATTERN = /\$\{?(EDITPROMPT_[A-Z_]+)/g;

export class CommandBackendConfigError extends Error {
  override name = "CommandBackendConfigError";
}

interface Script {
  /** Where the script is declared, such as `backends.mytty.focus`. */
  path: string;
  source: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseScript(
  value: unknown,
  path: string,
  field: CommandField,
  errors: string[],
): Script | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string`);
    return undefined;
  }

  // Catch a variable that is set for another command only, which would
  // silently expand to an empty string.
  const allowed: readonly string[] = COMMAND_VARIABLES[field];
  const reported = new Set<string>();
  for (const [, name] of value.matchAll(VARIABLE_PATTERN)) {
    const variable = name as string;
    if (COMMAND_VARIABLE_NAMES.has(variable) && !allowed.includes(variable)) {
      if (!reported.has(variable)) {
        reported.add(variable);
        const hint =
          allowed.length > 0 ? ` (available: ${allowed.map((n) => `$${n}`).join(", ")})` : "";
        errors.push(`${path} uses $${variable}, which is not set for this command${hint}`);
      }
    }
  }
  return { path, source: value };
}

function readEnvRef(value: unknown): string | undefined {
  if (isRecord(value) && Object.keys(value).length === 1 && typeof value.env === "string") {
    return value.env;
  }
  return undefined;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

interface ScriptResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runScript(script: Script, values: CommandValues, input?: string): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(SHELL, ["-c", script.source], {
      env: { ...process.env, ...values },
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
      reject(new Error(`Failed to run ${script.path}: ${error.message}`));
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    if (input !== undefined) {
      child.stdin?.on("error", (error) => {
        reject(new Error(`Failed to write to ${script.path}: ${error.message}`));
      });
      child.stdin?.end(input);
    }
  });
}

async function runChecked(script: Script, values: CommandValues, input?: string): Promise<string> {
  const result = await runScript(script, values, input);
  if (result.code !== 0) {
    throw new Error(`${script.path} exited with ${result.code}: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

/**
 * Validates a backend declared in the configuration file and builds it.
 * Throws CommandBackendConfigError listing every problem found.
 */
export function createCommandBackend(name: string, spec: unknown): MuxBackend {
  const path = `backends.${name}`;
  const errors: string[] = [];

  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name)) {
    errors.push(`${path}: the name may only contain letters, digits, "-" and "_"`);
  }
  if (!isRecord(spec)) {
    throw new CommandBackendConfigError(`${path} must be an object`);
  }
  for (const key of Object.keys(spec)) {
    if (!KNOWN_FIELDS.has(key)) {
      errors.push(`${path}.${key} is not a known option`);
    }
  }

  let detectEnv: string | undefined;
  if (spec.detect !== undefined) {
    detectEnv = readEnvRef(spec.detect);
    if (detectEnv === undefined) {
      errors.push(`${path}.detect must be { env = "VARIABLE_NAME" }`);
    }
  }

  const currentPaneEnv = readEnvRef(spec.currentPane);
  let currentPaneScript: Script | undefined;
  if (spec.currentPane === undefined) {
    errors.push(`${path}.currentPane is required`);
  } else if (currentPaneEnv === undefined) {
    currentPaneScript = parseScript(spec.currentPane, `${path}.currentPane`, "currentPane", errors);
  }

  const commands: Partial<Record<CommandField, Script>> = {};
  for (const field of REQUIRED_COMMANDS) {
    if (spec[field] === undefined) {
      errors.push(`${path}.${field} is required`);
    } else {
      commands[field] = parseScript(spec[field], `${path}.${field}`, field, errors);
    }
  }
  const optionalCount = OPTIONAL_COMMANDS.filter((field) => spec[field] !== undefined).length;
  if (optionalCount > 0 && optionalCount < OPTIONAL_COMMANDS.length) {
    errors.push(`${path}: splitPane, runInPane and closePane must be set together`);
  }
  for (const field of OPTIONAL_COMMANDS) {
    if (spec[field] !== undefined) {
      commands[field] = parseScript(spec[field], `${path}.${field}`, field, errors);
    }
  }

  const maxChunkBytes = spec.maxChunkBytes ?? DEFAULT_MAX_CHUNK_BYTES;
  if (typeof maxChunkBytes !== "number" || !Number.isInteger(maxChunkBytes) || maxChunkBytes < 4) {
    errors.push(`${path}.maxChunkBytes must be an integer of at least 4`);
  }
  const submitKey = spec.submitKey ?? "Enter";
  if (typeof submitKey !== "string" || submitKey === "") {
    errors.push(`${path}.submitKey must be a non-empty string`);
  }
  const quoteSeparator = spec.quoteSeparator ?? "\n\n";
  if (typeof quoteSeparator !== "string") {
    errors.push(`${path}.quoteSeparator must be a string`);
  }
  const collectInput = spec.collectInput ?? "argument";
  if (collectInput !== "stdin" && collectInput !== "argument") {
    errors.push(`${path}.collectInput must be "stdin" or "argument"`);
  }

  if (errors.length > 0) {
    throw new CommandBackendConfigError(errors.join("\n"));
  }

  const command = (field: CommandField) => commands[field] as Script;
  const namespace = () => `state.${name}`;

  const backend: MuxBackend = defineBackend({
    name,
    detect: detectEnv
      ? (env: NodeJS.ProcessEnv) => (env[detectEnv]?.trim() ?? "") !== ""
      : undefined,
    getCurrentPaneId: async () => {
      if (currentPaneEnv !== undefined) {
        const paneId = process.env[currentPaneEnv]?.trim();
        if (!paneId) {
          throw new Error(`${currentPaneEnv} is not set`);
        }
        return paneId;
      }
      return (await runChecked(currentPaneScript as Script, {})).trim();
    },
    paneExists: async (paneId) => {
      try {
        return (await runScript(command("paneExists"), { EDITPROMPT_PANE: paneId })).code === 0;
      } catch (error) {
        logger.debug("paneExists failed: {error}", { error });
        return false;
      }
    },
    focusPane: async (paneId) => {
      await runChecked(command("focus"), { EDITPROMPT_PANE: paneId });
    },
    sendText: async (paneId, chunk) => {
      await runChecked(command("sendText"), { EDITPROMPT_PANE: paneId }, chunk);
    },
    sendKey: async (paneId, key) => {
      await runChecked(command("sendKey"), { EDITPROMPT_PANE: paneId, EDITPROMPT_KEY: key });
    },
    maxChunkBytes: maxChunkBytes as number,
    defaultSubmitKey: submitKey as string,
    quoteSeparator: quoteSeparator as string,
    collectInput: collectInput as "stdin" | "argument",
    storageNamespace: namespace,
    resumeAcceptsEditorPane: true,
    keepNewerEditorLink: true,
    quietResumeErrors: "all",
    state: confStore(namespace),
  });

  if (commands.splitPane && commands.runInPane && commands.closePane) {
    const { splitPane, runInPane, closePane } = commands;
    backend.splitPane = async (targetPaneId, options) => {
      const stdout = await runChecked(splitPane, {
        EDITPROMPT_PANE: targetPaneId,
        EDITPROMPT_ROWS: String(options.rows),
        EDITPROMPT_CWD: options.cwd ?? process.cwd(),
      });
      const paneId = stdout.trim();
      if (paneId === "") {
        throw new Error(`${path}.splitPane did not print the new pane ID`);
      }
      return paneId;
    };
    backend.runInPane = async (paneId, argv) => {
      await runChecked(runInPane, {
        EDITPROMPT_PANE: paneId,
        EDITPROMPT_COMMAND: argv.map(shellQuote).join(" "),
      });
    };
    backend.closePane = async (paneId) => {
      await runChecked(closePane, { EDITPROMPT_PANE: paneId });
    };
  }

  return backend;
}
