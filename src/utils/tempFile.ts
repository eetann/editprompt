import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEMP_FILE_EXTENSION, TEMP_FILE_PREFIX } from "../config/constants";

function getFormattedDateTime(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	const seconds = String(now.getSeconds()).padStart(2, "0");
	return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

export async function createTempFile(): Promise<string> {
	const tempDir = join(tmpdir(), "editprompt-prompts");
	await mkdir(tempDir, { recursive: true });
	const fileName = `${TEMP_FILE_PREFIX}${getFormattedDateTime()}${TEMP_FILE_EXTENSION}`;
	const filePath = join(tempDir, fileName);
	await writeFile(filePath, "", "utf-8");
	return filePath;
}
