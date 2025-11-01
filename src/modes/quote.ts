import { appendToQuoteVariable } from "../modules/tmux";
import { processQuoteText } from "../utils/quoteProcessor";

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => {
      chunks.push(chunk);
    });
    process.stdin.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    process.stdin.on("error", (error) => {
      reject(error);
    });
  });
}

export async function runQuoteMode(targetPaneId: string): Promise<void> {
  try {
    // Read selection from stdin
    const selection = await readStdin();

    // Process text
    const processedText = processQuoteText(selection);

    // Append to pane variable
    await appendToQuoteVariable(targetPaneId, processedText);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    process.exit(1);
  }
}
