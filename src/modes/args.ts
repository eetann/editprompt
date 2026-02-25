import { getLogger } from "@logtape/logtape";
import type { ArgSchema } from "gunshi";
import { type MuxType, SUPPORTED_MUXES, isMuxType } from "./common";

const logger = getLogger(["editprompt"]);

export const ARG_MUX: ArgSchema = {
  short: "m",
  description: "Multiplexer type (tmux or wezterm, default: tmux)",
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

export function validateMux(value: unknown): MuxType {
  const muxValue = (value || "tmux") as string;
  if (!isMuxType(muxValue)) {
    logger.error(
      `Invalid multiplexer type '${muxValue}'. Supported values: ${SUPPORTED_MUXES.join(", ")}`,
    );
    process.exit(1);
  }
  return muxValue;
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
