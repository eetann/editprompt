/**
 * Parses environment variable strings into an object.
 * @param envStrings - An array of strings in the format ["KEY=VALUE", "FOO=bar"].
 * @returns An object of environment variable key-value pairs.
 */
export function parseEnvVars(envStrings?: string[]): Record<string, string> {
	if (!envStrings || envStrings.length === 0) {
		return {};
	}

	const result: Record<string, string> = {};

	for (const envString of envStrings) {
		const [key, ...valueParts] = envString.split("=");

		if (!key || valueParts.length === 0) {
			throw new Error(`Invalid environment variable format: ${envString}`);
		}

		// Handle cases where the value includes an equals sign.
		const value = valueParts.join("=");
		result[key] = value;
	}

	return result;
}
