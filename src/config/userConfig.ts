import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createCommandBackend } from "../backends/command";
import {
  detectBackendName,
  FALLBACK_BACKEND_NAME,
  isBuiltinBackendName,
  registerBackend,
} from "../backends/registry";

const RC_FILE = ".editpromptrc";

export interface EditpromptConfig {
  /** Additional backends, keyed by the name used with `--mux`. */
  backends?: Record<string, unknown>;
}

/**
 * The directory holding the configuration file: `EDITPROMPT_CONFIG_DIR`, or
 * `editprompt` under `XDG_CONFIG_HOME` (default `~/.config`).
 */
export function getConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.EDITPROMPT_CONFIG_DIR?.trim();
  if (explicit) {
    return explicit;
  }
  const configHome = env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  return join(configHome, "editprompt");
}

/**
 * Loads the configuration with c12, so every format c12 supports works:
 * `config.{json,jsonc,json5,yaml,yml,toml,js,ts,mjs,cjs,mts,cts}` in the
 * config directory, and the `.editpromptrc` RC file there, in
 * `$XDG_CONFIG_HOME` or in the home directory.
 *
 * Configuration is read from the user's config directory only, never from the
 * current working directory: a repository must not be able to change how
 * editprompt talks to the terminal, or run code through a config file.
 */
export async function loadUserConfig(
  configDir: string = getConfigDir(),
): Promise<EditpromptConfig> {
  const { loadConfig } = await import("c12");
  const { config } = await loadConfig<EditpromptConfig>({
    name: "editprompt",
    cwd: configDir,
    configFile: "config",
    rcFile: RC_FILE,
    globalRc: true,
    dotenv: false,
    packageJson: false,
  });
  return config ?? {};
}

/**
 * Registers the backends declared in the configuration. Returns one message
 * per backend that could not be registered, so that a broken entry does not
 * take the built-in backends down with it.
 */
export function registerConfiguredBackends(config: EditpromptConfig): string[] {
  const errors: string[] = [];
  const { backends } = config;
  if (backends === undefined) {
    return errors;
  }
  if (typeof backends !== "object" || backends === null || Array.isArray(backends)) {
    return ["backends must be an object keyed by backend name"];
  }

  for (const [name, spec] of Object.entries(backends)) {
    if (isBuiltinBackendName(name)) {
      errors.push(`backends.${name}: '${name}' is a built-in backend and cannot be redefined`);
      continue;
    }
    try {
      registerBackend(createCommandBackend(name, spec));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return errors;
}

/**
 * Returns the `--mux` value given on the command line, ignoring anything after
 * `--` (content passed to input, collect or stash).
 */
function findMuxArgument(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--") {
      return undefined;
    }
    if (arg === "--mux" || arg === "-m") {
      return argv[i + 1];
    }
    if (arg.startsWith("--mux=")) {
      return arg.slice("--mux=".length);
    }
  }
  return undefined;
}

/**
 * Decides whether this invocation can use a configured backend at all, so that
 * the common case skips loading c12. Configured backends cannot replace
 * built-in ones and are detected after them, so they only matter when an
 * explicit `--mux`/EDITPROMPT_MUX names a non-built-in backend, or when
 * auto-detection would otherwise fall back to tmux.
 */
export function mayUseConfiguredBackend(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const explicit = findMuxArgument(argv) || env.EDITPROMPT_MUX;
  if (explicit) {
    return !isBuiltinBackendName(explicit);
  }
  return detectBackendName(env) === FALLBACK_BACKEND_NAME;
}

/** Returns true when one of the files c12 would read exists. */
export function hasConfigFiles(
  configDir: string = getConfigDir(),
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    existsSync(configDir) || existsSync(join(env.XDG_CONFIG_HOME?.trim() || homedir(), RC_FILE))
  );
}

/** Loads the configuration and registers its backends, reporting problems on stderr. */
export async function setupUserConfig(configDir: string = getConfigDir()): Promise<void> {
  if (!hasConfigFiles(configDir)) {
    return;
  }
  let config: EditpromptConfig;
  try {
    config = await loadUserConfig(configDir);
  } catch (error) {
    console.error(
      `editprompt: failed to load the configuration: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }
  for (const message of registerConfiguredBackends(config)) {
    console.error(`editprompt: invalid configuration: ${message}`);
  }
}
