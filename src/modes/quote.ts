import type { MuxType } from "../modules/process";
import { appendToQuoteVariable } from "../modules/tmux";
import { appendToQuoteText } from "../modules/wezterm";
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

export async function runQuoteMode(
  mux: MuxType,
  targetPaneId: string,
  rawContent?: string,
): Promise<void> {
  try {
    let selection: string;

    if (rawContent !== undefined) {
      // Use positional argument (wezterm)
      selection = rawContent;
    } else {
      // Read from stdin (tmux)
      selection = await readStdin();
    }

    // Process text
    const processedText = processQuoteText(selection);

    // Append to multiplexer storage
    if (mux === "tmux") {
      await appendToQuoteVariable(targetPaneId, processedText);
    } else if (mux === "wezterm") {
      await appendToQuoteText(targetPaneId, processedText);
    }
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    process.exit(1);
  }
}
