import { herdrBackend } from "./herdr";
import { niwatermBackend } from "./niwaterm";
import { rexBackend } from "./rex";
import { tmuxBackend } from "./tmux";
import type { MuxBackend } from "./types";
import { weztermBackend } from "./wezterm";

/** Used when nothing is configured and no backend detects its environment. */
export const FALLBACK_BACKEND_NAME = "tmux";

const BUILTIN_BACKENDS: readonly MuxBackend[] = [
  tmuxBackend,
  weztermBackend,
  herdrBackend,
  niwatermBackend,
  rexBackend,
];

// Insertion order is the detection order: built-in backends first (Herdr,
// niwaterm, Rex), then backends registered from the user's configuration.
const backends = new Map<string, MuxBackend>(BUILTIN_BACKENDS.map((b) => [b.name, b]));

export function isBuiltinBackendName(name: string): boolean {
  return BUILTIN_BACKENDS.some((backend) => backend.name === name);
}

export function registerBackend(backend: MuxBackend): void {
  if (backends.has(backend.name)) {
    throw new Error(`A backend named '${backend.name}' is already registered`);
  }
  backends.set(backend.name, backend);
}

/** Removes a non-built-in backend. Intended for tests. */
export function unregisterBackend(name: string): void {
  if (isBuiltinBackendName(name)) {
    throw new Error(`Cannot unregister the built-in backend '${name}'`);
  }
  backends.delete(name);
}

export function hasBackend(name: unknown): name is string {
  return typeof name === "string" && backends.has(name);
}

export function listBackendNames(): string[] {
  return [...backends.keys()];
}

export function getBackend(name: string): MuxBackend {
  const backend = backends.get(name);
  if (!backend) {
    throw new Error(
      `Invalid multiplexer type '${name}'. Supported values: ${listBackendNames().join(", ")}`,
    );
  }
  return backend;
}

export function detectBackendName(env: NodeJS.ProcessEnv = process.env): string {
  for (const backend of backends.values()) {
    if (backend.detect?.(env)) {
      return backend.name;
    }
  }
  return FALLBACK_BACKEND_NAME;
}

/**
 * Resolves the backend name from, in order: the explicit `--mux` value,
 * `EDITPROMPT_MUX`, and auto-detection. Throws for an unknown name.
 */
export function resolveBackendName(
  explicit?: unknown,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = explicit || env.EDITPROMPT_MUX || detectBackendName(env);
  if (!hasBackend(value)) {
    const displayValue = typeof value === "string" ? value : `<${typeof value}>`;
    throw new Error(
      `Invalid multiplexer type '${displayValue}'. Supported values: ${listBackendNames().join(", ")}`,
    );
  }
  return value;
}

export function resolveBackend(
  explicit?: unknown,
  env: NodeJS.ProcessEnv = process.env,
): MuxBackend {
  return getBackend(resolveBackendName(explicit, env));
}
