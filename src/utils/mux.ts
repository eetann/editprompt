import { resolveBackendName } from "../backends/registry";

export { isHerdrEnvironment, isNiwatermEnvironment, isRexEnvironment } from "../backends/env";

/**
 * Name of a registered backend: one of the built-in multiplexers or a backend
 * defined in the user's configuration file.
 */
export type MuxType = string;

export function resolveMux(explicitMux?: unknown, env: NodeJS.ProcessEnv = process.env): MuxType {
  return resolveBackendName(explicitMux, env);
}
