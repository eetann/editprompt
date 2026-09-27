import { getLogger } from "@logtape/logtape";
import type { ArgSchema } from "gunshi";
import { type MuxType, resolveMux } from "../utils/mux";

const logger = getLogger(["editprompt"]);

export const ARG_MUX: ArgSchema = {
  short: "m",
  description:
    "Multiplexer type (tmux, wezterm, herdr, or niwaterm; auto-detects Herdr and niwaterm, otherwise tmux)",
  type: "string",
};

export const ARG_TARGET_PANE_SINGLE: ArgSchema = {
  short: "t",
  description: "Target pane ID",
  type: "string",
};

export const ARG_TARGET_PANE_MULTI: ArgSchema = {
  short: "t",
  description: "Target pane ID (can be specified multiple times)",
  type: "string",
  multiple: true,
};

export const ARG_EDITOR: ArgSchema = {
  short: "e",
  description: "Editor to use (overrides $EDITOR)",
  type: "string",
};

export const ARG_ALWAYS_COPY: ArgSchema = {
  description: "Always copy content to clipboard",
  type: "boolean",
};

export const ARG_NO_QUOTE: ArgSchema = {
  description: "Disable quote prefix and trailing blank lines",
  type: "boolean",
};

export const ARG_OUTPUT: ArgSchema = {
  description: "Output destination (buffer, stdout). Can be specified multiple times",
  type: "string",
  multiple: true,
};

export const ARG_LOG_FILE: ArgSchema = {
  description: "Write logs to the specified file (appends)",
  type: "string",
};

export const ARG_QUIET: ArgSchema = {
  short: "q",
  description: "Suppress all log output",
  type: "boolean",
};

export const ARG_VERBOSE: ArgSchema = {
  short: "v",
  description: "Enable debug-level log output",
  type: "boolean",
};

export const ARG_ENV: ArgSchema = {
  short: "E",
  description: "Environment variables to set (e.g., KEY=VALUE)",
  type: "string",
  multiple: true,
};

export function validateMux(value: unknown): MuxType {
  try {
    return resolveMux(value);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function validateTargetPane(value: unknown, commandName: string): string {
  if (!value || typeof value !== "string") {
    logger.error(`--target-pane is required for ${commandName} command`);
    process.exit(1);
  }
  return value;
}

export function normalizeTargetPanes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value)];
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}
