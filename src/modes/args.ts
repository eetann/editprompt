import type { ArgSchema } from "gunshi";
import { type MuxType, SUPPORTED_MUXES, isMuxType } from "./common";

export const ARG_MUX: ArgSchema = {
  short: "m",
  description: "Multiplexer type (tmux or wezterm, default: tmux)",
  type: "string",
};

export const ARG_TARGET_PANE: ArgSchema = {
  short: "t",
  description: "Target pane ID",
  type: "string",
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

export function validateMux(value: unknown): MuxType {
  const muxValue = (value || "tmux") as string;
  if (!isMuxType(muxValue)) {
    console.error(
      `Error: Invalid multiplexer type '${muxValue}'. Supported values: ${SUPPORTED_MUXES.join(", ")}`,
    );
    process.exit(1);
  }
  return muxValue;
}

export function validateTargetPane(
  value: unknown,
  commandName: string,
): string {
  if (!value || typeof value !== "string") {
    console.error(
      `Error: --target-pane is required for ${commandName} command`,
    );
    process.exit(1);
  }
  return value;
}
