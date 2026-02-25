import type { MuxType } from "../modes/common";
import type { SendConfig } from "../types/send";

const VALID_MUX_TYPES = ["tmux", "wezterm"] as const;

export function readSendConfig(): SendConfig {
  const muxValue = process.env.EDITPROMPT_MUX || "tmux";

  if (!VALID_MUX_TYPES.includes(muxValue as MuxType)) {
    throw new Error(
      `Invalid EDITPROMPT_MUX value: ${muxValue}. Must be one of: ${VALID_MUX_TYPES.join(", ")}`,
    );
  }

  const mux = muxValue as MuxType;
  const alwaysCopy = process.env.EDITPROMPT_ALWAYS_COPY === "1";

  const delayValue = process.env.EDITPROMPT_SEND_KEY_DELAY;
  const parsedDelay = delayValue ? Number.parseInt(delayValue, 10) : Number.NaN;
  const sendKeyDelay = Number.isNaN(parsedDelay) ? 1000 : parsedDelay;

  return {
    mux,
    alwaysCopy,
    sendKeyDelay,
  };
}
