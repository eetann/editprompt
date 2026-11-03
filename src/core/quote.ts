import type { MuxBackend } from "../backends/types";

/** Appends a quote to the target pane's quote buffer. */
export async function appendQuote(
  backend: MuxBackend,
  targetPaneId: string,
  content: string,
): Promise<void> {
  const existing = await backend.state.getQuote(targetPaneId);
  const quote = existing.trim() !== "" ? `${existing}${backend.quoteSeparator}${content}` : content;
  await backend.state.setQuote(targetPaneId, quote);
}

/** Returns the target pane's quote buffer and clears it. */
export async function takeQuote(backend: MuxBackend, targetPaneId: string): Promise<string> {
  const quote = await backend.state.getQuote(targetPaneId);
  await backend.state.removeQuote(targetPaneId);
  return quote;
}
