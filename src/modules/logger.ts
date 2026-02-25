import { appendFileSync } from "node:fs";
import {
  type LogLevel,
  type Sink,
  configureSync,
  getAnsiColorFormatter,
  getTextFormatter,
  parseLogLevel,
  withFilter,
} from "@logtape/logtape";

export interface SetupLoggerOptions {
  quiet?: boolean;
  verbose?: boolean;
  logFile?: string;
}

export function resolveLogFilePath(options: SetupLoggerOptions): string | undefined {
  if (options.logFile) {
    return options.logFile;
  }
  const envPath = process.env.EDITPROMPT_LOG_FILE;
  if (envPath) {
    return envPath;
  }
  return undefined;
}

export function resolveFileLogLevel(options: SetupLoggerOptions): LogLevel {
  if (options.verbose) {
    return "debug";
  }
  const envLevel = process.env.EDITPROMPT_LOG_LEVEL;
  if (envLevel) {
    return parseLogLevel(envLevel);
  }
  return "info";
}

export function resolveLogLevel(options: SetupLoggerOptions): LogLevel | null {
  if (options.quiet) {
    return null;
  }
  if (options.verbose) {
    return "debug";
  }
  const envLevel = process.env.EDITPROMPT_LOG_LEVEL;
  if (envLevel) {
    return parseLogLevel(envLevel);
  }
  return "info";
}

export function setupLogger(options: SetupLoggerOptions = {}): void {
  const stderrLevel = resolveLogLevel(options);

  const stderrFormatter = getAnsiColorFormatter({
    timestamp: "time-timezone",
    level: "ABBR",
  });
  const rawStderrSink: Sink = (record) => {
    process.stderr.write(stderrFormatter(record));
  };
  // Apply level filter to stderr sink (withFilter handles null by dropping all)
  const stderrSink: Sink =
    stderrLevel === null
      ? () => {} // --quiet: drop all stderr logs
      : withFilter(rawStderrSink, stderrLevel);

  const sinks: Record<string, Sink> = { stderr: stderrSink };
  const loggerSinks: string[] = ["stderr"];

  const logFilePath = resolveLogFilePath(options);
  const fileLogLevel = resolveFileLogLevel(options);
  if (logFilePath) {
    try {
      // Verify the file is writable by appending empty string
      appendFileSync(logFilePath, "");
      const fileFormatter = getTextFormatter({
        timestamp: "date-time-timezone",
        level: "ABBR",
      });
      const rawFileSink: Sink = (record) => {
        appendFileSync(logFilePath, fileFormatter(record));
      };
      sinks.file = withFilter(rawFileSink, fileLogLevel);
      loggerSinks.push("file");
    } catch {
      process.stderr.write(
        `Warning: Cannot write to log file '${logFilePath}', continuing without file logging.\n`,
      );
    }
  }

  configureSync({
    sinks,
    loggers: [
      {
        category: ["editprompt"],
        sinks: loggerSinks,
        lowestLevel: "trace",
      },
      {
        category: ["logtape", "meta"],
        lowestLevel: null,
      },
    ],
  });
}
