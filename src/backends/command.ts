import { spawn } from "node:child_process";
import { getLogger } from "@logtape/logtape";
import { confStore } from "./stores";
import { defineBackend, type MuxBackend } from "./types";

const logger = getLogger(["editprompt", "command-backend"]);

/** A command as an argv array, optionally receiving text on stdin. */
export type CommandSpec = string[] | { argv: string[]; stdin?: boolean };

/**
 * A backend declared in the configuration file. Every operation is a command
 * run without a shell; `{placeholder}`s in its arguments are replaced with
 * the values of the call.
 */
export interface CommandBackendSpec {
  /** Selects this backend automatically when the environment variable is set. */
  detect?: { env: string };
  /** The pane editprompt runs in: read from an environment variable or a command's stdout. */
  currentPane: { env: string } | CommandSpec;
  /** Exits 0 when `{pane}` exists. */
  paneExists: CommandSpec;
  /** Focuses `{pane}`. */
  focus: CommandSpec;
  /** Types text into `{pane}`: as `{text}` or, with `stdin: true`, on stdin. */
  sendText: CommandSpec;
  /** Sends `{key}` to `{pane}`. */
  sendKey: CommandSpec;
  /** Largest chunk of text passed to one sendText call. Default 8192. */
  maxChunkBytes?: number;
  /** Key sent by `input --auto-send`. Default "Enter". */
  submitKey?: string;
  /** Separator between quotes collected by `collect`. Default "\n\n". */
  quoteSeparator?: string;
  /** Where `collect` reads the selection from. Default "argument". */
  collectInput?: "stdin" | "argument";
  /** Splits a pane next to `{pane}` with `{rows}` rows in `{cwd}`; prints the new pane ID. */
  splitPane?: CommandSpec;
  /** Runs `{command}` (the shell-quoted editprompt command line) in `{pane}`. */
  runInPane?: CommandSpec;
  /** Closes `{pane}`. */
  closePane?: CommandSpec;
}

const COMMAND_PLACEHOLDERS = {
  currentPane: [],
  paneExists: ["pane"],
  focus: ["pane"],
  sendText: ["pane", "text"],
  sendKey: ["pane", "key"],
  splitPane: ["pane", "rows", "cwd"],
  runInPane: ["pane", "command"],
  closePane: ["pane"],
} as const satisfies Record<string, readonly string[]>;

type CommandField = keyof typeof COMMAND_PLACEHOLDERS;

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
const PLACEHOLDER_PATTERN = /\{([A-Za-z]+)\}/g;

export class CommandBackendConfigError extends Error {
  override name = "CommandBackendConfigError";
}

interface NormalizedCommand {
  argv: string[];
  stdin: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeCommand(
  value: unknown,
  path: string,
  field: CommandField,
  errors: string[],
): NormalizedCommand | undefined {
  const command = isRecord(value) ? value : { argv: value };
  const { argv, stdin = false, ...rest } = command;
  if (!isStringArray(argv) || argv.length === 0) {
    errors.push(`${path} must be a non-empty array of strings or { "argv": [...] }`);
    return undefined;
  }
  if (typeof stdin !== "boolean") {
    errors.push(`${path}.stdin must be a boolean`);
  }
  for (const key of Object.keys(rest)) {
    errors.push(`${path}.${key} is not a known option`);
  }

  const allowed: readonly string[] = COMMAND_PLACEHOLDERS[field];
  for (const arg of argv) {
    for (const [, name] of arg.matchAll(PLACEHOLDER_PATTERN)) {
      if (!allowed.includes(name as string)) {
        const hint =
          allowed.length > 0 ? ` (allowed: ${allowed.map((n) => `{${n}}`).join(", ")})` : "";
        errors.push(`${path} uses an unknown placeholder {${name}}${hint}`);
      }
    }
  }
  return { argv, stdin: stdin === true };
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

function fillArgs(argv: string[], values: Record<string, string>): string[] {
  return argv.map((arg) =>
    arg.replace(PLACEHOLDER_PATTERN, (match, name: string) => values[name] ?? match),
  );
}

interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runCommand(argv: string[], input?: string): Promise<CommandResult> {
  const [command, ...args] = argv as [string, ...string[]];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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
      reject(new Error(`Failed to run ${command}: ${error.message}`));
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    if (input !== undefined) {
      child.stdin?.on("error", (error) => {
        reject(new Error(`Failed to write to ${command}: ${error.message}`));
      });
      child.stdin?.end(input);
    }
  });
}

async function runChecked(
  command: NormalizedCommand,
  values: Record<string, string>,
  input?: string,
): Promise<string> {
  const argv = fillArgs(command.argv, values);
  const result = await runCommand(argv, command.stdin ? (input ?? "") : undefined);
  if (result.code !== 0) {
    throw new Error(`${argv.join(" ")} exited with ${result.code}: ${result.stderr.trim()}`);
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
      errors.push(`${path}.detect must be { "env": "VARIABLE_NAME" }`);
    }
  }

  const currentPaneEnv = readEnvRef(spec.currentPane);
  let currentPaneCommand: NormalizedCommand | undefined;
  if (spec.currentPane === undefined) {
    errors.push(`${path}.currentPane is required`);
  } else if (currentPaneEnv === undefined) {
    currentPaneCommand = normalizeCommand(
      spec.currentPane,
      `${path}.currentPane`,
      "currentPane",
      errors,
    );
  }

  const commands: Partial<Record<CommandField, NormalizedCommand>> = {};
  for (const field of REQUIRED_COMMANDS) {
    if (spec[field] === undefined) {
      errors.push(`${path}.${field} is required`);
    } else {
      commands[field] = normalizeCommand(spec[field], `${path}.${field}`, field, errors);
    }
  }
  const optionalCount = OPTIONAL_COMMANDS.filter((field) => spec[field] !== undefined).length;
  if (optionalCount > 0 && optionalCount < OPTIONAL_COMMANDS.length) {
    errors.push(`${path}: splitPane, runInPane and closePane must be set together`);
  }
  for (const field of OPTIONAL_COMMANDS) {
    if (spec[field] !== undefined) {
      commands[field] = normalizeCommand(spec[field], `${path}.${field}`, field, errors);
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

  const command = (field: CommandField) => commands[field] as NormalizedCommand;
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
      return (await runChecked(currentPaneCommand as NormalizedCommand, {})).trim();
    },
    paneExists: async (paneId) => {
      try {
        const argv = fillArgs(command("paneExists").argv, { pane: paneId });
        return (await runCommand(argv)).code === 0;
      } catch (error) {
        logger.debug("paneExists failed: {error}", { error });
        return false;
      }
    },
    focusPane: async (paneId) => {
      await runChecked(command("focus"), { pane: paneId });
    },
    sendText: async (paneId, chunk) => {
      await runChecked(command("sendText"), { pane: paneId, text: chunk }, chunk);
    },
    sendKey: async (paneId, key) => {
      await runChecked(command("sendKey"), { pane: paneId, key });
    },
    maxChunkBytes: maxChunkBytes as number,
    defaultSubmitKey: submitKey as string,
    quoteSeparator: quoteSeparator as string,
    collectInput: collectInput as "stdin" | "argument",
    storageNamespace: namespace,
    state: confStore(namespace),
  });

  if (commands.splitPane && commands.runInPane && commands.closePane) {
    const { splitPane, runInPane, closePane } = commands;
    backend.splitPane = async (targetPaneId, options) => {
      const stdout = await runChecked(splitPane, {
        pane: targetPaneId,
        rows: String(options.rows),
        cwd: options.cwd ?? process.cwd(),
      });
      const paneId = stdout.trim();
      if (paneId === "") {
        throw new Error(`${path}.splitPane did not print the new pane ID`);
      }
      return paneId;
    };
    backend.runInPane = async (paneId, argv) => {
      await runChecked(runInPane, { pane: paneId, command: argv.map(shellQuote).join(" ") });
    };
    backend.closePane = async (paneId) => {
      await runChecked(closePane, { pane: paneId });
    };
  }

  return backend;
}
