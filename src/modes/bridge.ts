import { getLogger } from "@logtape/logtape";
import { define } from "gunshi";
import { getBackend } from "../backends/registry";
import type { MuxBackend } from "../backends/types";
import { type BridgeEvent, createSocketPath, startBridge } from "../core/bridge";
import { setupLogger } from "../modules/logger";
import {
  ARG_LOG_FILE,
  ARG_MUX,
  ARG_QUIET,
  ARG_TARGET_PANE_SINGLE,
  ARG_VERBOSE,
  validateMux,
} from "./args";

const logger = getLogger(["editprompt", "bridge"]);

// How often the bridge checks that the agent that started it is still alive.
const PARENT_CHECK_INTERVAL_MS = 5000;

/**
 * Starts a bridge for a target pane and records its socket there. Returns a
 * function that stops it and forgets the socket, unless another bridge has
 * replaced it in the meantime.
 */
export async function runBridge(
  backend: MuxBackend,
  targetPaneId: string,
  emit: (event: BridgeEvent) => void,
  socketDir?: string,
): Promise<() => Promise<void>> {
  const socketPath = createSocketPath(socketDir);
  const server = await startBridge({ socketPath, emit });
  await backend.state.setBridgeSocket(targetPaneId, socketPath);
  logger.debug("Bridge for pane {targetPaneId} listens on {socketPath}", {
    targetPaneId,
    socketPath,
  });

  return async () => {
    server.close();
    server.closeAllConnections();
    if ((await backend.state.getBridgeSocket(targetPaneId)) === socketPath) {
      await backend.state.removeBridgeSocket(targetPaneId);
    }
  };
}

export const bridgeCommand = define({
  name: "bridge",
  description: "Connect an agent's prompt box to `editprompt pull` (run by the agent plugin)",
  args: {
    mux: ARG_MUX,
    "target-pane": ARG_TARGET_PANE_SINGLE,
    "log-file": ARG_LOG_FILE,
    quiet: ARG_QUIET,
    verbose: ARG_VERBOSE,
  },
  async run(ctx) {
    setupLogger({
      quiet: Boolean(ctx.values.quiet),
      verbose: Boolean(ctx.values.verbose),
      logFile: ctx.values["log-file"] as string | undefined,
    });
    try {
      const backend = getBackend(validateMux(ctx.values.mux));
      const targetPane = ctx.values["target-pane"];
      const targetPaneId =
        typeof targetPane === "string" && targetPane !== ""
          ? targetPane
          : await backend.getCurrentPaneId();
      const stop = await runBridge(backend, targetPaneId, (event) => {
        process.stdout.write(`${JSON.stringify(event)}\n`);
      });

      let isStopping = false;
      const shutdown = async () => {
        if (isStopping) {
          return;
        }
        isStopping = true;
        await stop().catch(() => {});
        process.exit(0);
      };
      for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) {
        process.on(signal, shutdown);
      }
      // The agent reads stdout; once it is gone, nobody answers the pulls.
      process.stdout.on("error", shutdown);
      const parentPid = process.ppid;
      setInterval(() => {
        if (process.ppid !== parentPid) {
          void shutdown();
        }
      }, PARENT_CHECK_INTERVAL_MS).unref();
    } catch (error) {
      logger.error(`${error instanceof Error ? error.message : "Unknown error"}`);
      process.exit(1);
    }
  },
});
