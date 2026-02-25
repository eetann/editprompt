import {
	type LogLevel,
	type Sink,
	configureSync,
	getAnsiColorFormatter,
	parseLogLevel,
} from "@logtape/logtape";

export interface SetupLoggerOptions {
	quiet?: boolean;
	verbose?: boolean;
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
	const level = resolveLogLevel(options);

	const formatter = getAnsiColorFormatter({
		timestamp: "time-timezone",
		level: "ABBR",
	});
	const stderrSink: Sink = (record) => {
		process.stderr.write(formatter(record));
	};

	configureSync({
		sinks: {
			stderr: stderrSink,
		},
		loggers: [
			{
				category: ["editprompt"],
				sinks: ["stderr"],
				lowestLevel: level,
			},
			{
				category: ["logtape", "meta"],
				lowestLevel: null,
			},
		],
	});
}
