import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { DEFAULT_EDITOR } from "../config/constants";
import { createTempFile } from "../utils/tempFile";

export function getEditor(editorOption?: string): string {
	return editorOption || process.env.EDITOR || DEFAULT_EDITOR;
}

export async function launchEditor(
	editor: string,
	filePath: string,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const editorProcess = spawn(editor, [filePath], {
			stdio: "inherit",
			shell: true,
		});

		editorProcess.on("error", (error) => {
			reject(new Error(`Failed to launch editor: ${error.message}`));
		});

		editorProcess.on("exit", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Editor exited with code: ${code}`));
			}
		});
	});
}

export async function readFileContent(filePath: string): Promise<string> {
	try {
		const content = await readFile(filePath, "utf-8");
		return content.trim();
	} catch (error) {
		throw new Error(
			`Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

export async function openEditorAndGetContent(
	editorOption?: string,
): Promise<string> {
	const tempFilePath = await createTempFile();
	const editor = getEditor(editorOption);

	try {
		await launchEditor(editor, tempFilePath);
		const content = await readFileContent(tempFilePath);

		return content;
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		}
		throw new Error("An unknown error occurred");
	}
}
