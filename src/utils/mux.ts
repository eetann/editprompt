export type MuxType = "tmux" | "wezterm" | "herdr" | "niwaterm";

export const SUPPORTED_MUXES: MuxType[] = ["tmux", "wezterm", "herdr", "niwaterm"];

export function isMuxType(value: unknown): value is MuxType {
  return value === "tmux" || value === "wezterm" || value === "herdr" || value === "niwaterm";
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

export function isHerdrEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    hasValue(env.HERDR_SOCKET_PATH) &&
    (hasValue(env.HERDR_PANE_ID) || hasValue(env.HERDR_ACTIVE_PANE_ID))
  );
}

export function isNiwatermEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return hasValue(env.NIWATERM_TAB_ID);
}

export function resolveMux(explicitMux?: unknown, env: NodeJS.ProcessEnv = process.env): MuxType {
  const muxValue =
    explicitMux ||
    env.EDITPROMPT_MUX ||
    (isHerdrEnvironment(env) ? "herdr" : isNiwatermEnvironment(env) ? "niwaterm" : "tmux");

  if (!isMuxType(muxValue)) {
    const displayValue = typeof muxValue === "string" ? muxValue : `<${typeof muxValue}>`;
    throw new Error(
      `Invalid multiplexer type '${displayValue}'. Supported values: ${SUPPORTED_MUXES.join(", ")}`,
    );
  }

  return muxValue;
}
