export type MuxType = "tmux" | "wezterm" | "herdr" | "niwaterm" | "rex";

export const SUPPORTED_MUXES: MuxType[] = ["tmux", "wezterm", "herdr", "niwaterm", "rex"];

export function isMuxType(value: unknown): value is MuxType {
  return (
    value === "tmux" ||
    value === "wezterm" ||
    value === "herdr" ||
    value === "niwaterm" ||
    value === "rex"
  );
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

// Rex sets REX_SESSION, REX_BLOCK, REX_CLIENT and REX_BIN_DIR in the terminals
// it opens. REX_BLOCK is the one the backend cannot work without, since it
// names the pane editprompt is running in, while the session is never needed:
// a block ID resolves without it.
export function isRexEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return hasValue(env.REX_BLOCK);
}

export function resolveMux(explicitMux?: unknown, env: NodeJS.ProcessEnv = process.env): MuxType {
  const muxValue =
    explicitMux ||
    env.EDITPROMPT_MUX ||
    (isHerdrEnvironment(env)
      ? "herdr"
      : isNiwatermEnvironment(env)
        ? "niwaterm"
        : isRexEnvironment(env)
          ? "rex"
          : "tmux");

  if (!isMuxType(muxValue)) {
    const displayValue = typeof muxValue === "string" ? muxValue : `<${typeof muxValue}>`;
    throw new Error(
      `Invalid multiplexer type '${displayValue}'. Supported values: ${SUPPORTED_MUXES.join(", ")}`,
    );
  }

  return muxValue;
}
