import type { MuxType } from "../modules/process";
import type { SendConfig } from "../types/send";

const VALID_MUX_TYPES = ["tmux", "wezterm"] as const;

export function readSendConfig(): SendConfig {
	const targetPane = process.env.EDITPROMPT_TARGET_PANE;
	const muxValue = process.env.EDITPROMPT_MUX || "tmux";

	if (!VALID_MUX_TYPES.includes(muxValue as MuxType)) {
		throw new Error(
			`Invalid EDITPROMPT_MUX value: ${muxValue}. Must be one of: ${VALID_MUX_TYPES.join(", ")}`,
		);
	}

	const mux = muxValue as MuxType;
	const alwaysCopy = process.env.EDITPROMPT_ALWAYS_COPY === "1";

	return {
		targetPane,
		mux,
		alwaysCopy,
	};
}
