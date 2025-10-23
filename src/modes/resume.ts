import {
	checkPaneExists,
	clearEditorPaneId,
	focusPane,
	getEditorPaneId,
} from "../modules/tmux";

export async function runResumeMode(targetPane: string): Promise<void> {
	const editorPaneId = await getEditorPaneId(targetPane);

	if (!editorPaneId) {
		process.exit(1);
	}

	const exists = await checkPaneExists(editorPaneId);
	if (!exists) {
		await clearEditorPaneId(targetPane);
		process.exit(1);
	}

	await focusPane(editorPaneId);
	process.exit(0);
}
