/**
 * 環境変数文字列をパースしてオブジェクトに変換
 * @param envStrings - ["KEY=VALUE", "FOO=bar"] 形式の配列
 * @returns 環境変数のキーバリューオブジェクト
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

		const value = valueParts.join("="); // 値に=が含まれる場合に対応
		result[key] = value;
	}

	return result;
}
