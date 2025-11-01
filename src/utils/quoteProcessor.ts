/**
 * Calculate the minimum leading whitespace count across all non-empty lines
 */
function getMinLeadingWhitespace(lines: string[]): number {
  let min = 99;
  for (const line of lines) {
    if (line.length === 0) continue;
    const match = line.match(/^[ \t]*/);
    const count = match ? match[0].length : 0;
    if (count < min) {
      min = count;
    }
  }
  return min === 99 ? 0 : min;
}

/**
 * Check if we need a space separator between two lines
 */
function needsSpaceSeparator(prevLine: string, currentLine: string): boolean {
  if (prevLine.length === 0 || currentLine.length === 0) {
    return false;
  }

  const lastChar = prevLine[prevLine.length - 1] ?? "";
  const firstChar = currentLine[0] ?? "";

  // Check if both are alphabetic (a-z, A-Z)
  const isLastCharAlpha = /[a-zA-Z]/.test(lastChar);
  const isFirstCharAlpha = /[a-zA-Z]/.test(firstChar);

  return isLastCharAlpha && isFirstCharAlpha;
}

/**
 * Determine if two lines should be merged
 */
function shouldMergeLines(prevLine: string, currentLine: string): boolean {
  // Don't merge if current line starts with Markdown list marker
  if (/^[-*+]\s/.test(currentLine)) {
    return false;
  }

  // Don't merge if both lines contain colons (: or ：)
  const hasColon = (line: string) => line.includes(":") || line.includes("：");
  if (hasColon(prevLine) && hasColon(currentLine)) {
    return false;
  }

  // Merge by default
  return true;
}

/**
 * Remove common leading whitespace and merge lines
 */
function removeWhitespaceAndMergeLines(lines: string[]): string[] {
  // Remove common leading whitespace
  const minWhitespace = getMinLeadingWhitespace(lines);
  const trimmedLines = lines.map((line) => {
    if (line.length === 0) return line;
    return line.slice(minWhitespace);
  });

  // Merge lines
  const result: string[] = [];
  let currentLine = "";

  for (let i = 0; i < trimmedLines.length; i++) {
    const line = trimmedLines[i] ?? "";

    if (i === 0) {
      currentLine = line;
      continue;
    }

    // Empty lines should always preserve line breaks
    if (line.length === 0) {
      result.push(currentLine);
      result.push("");
      currentLine = "";
      continue;
    }

    // If current line is not empty but we have an accumulated empty currentLine from previous empty line
    if (currentLine.length === 0) {
      currentLine = line;
      continue;
    }

    const prevLine = trimmedLines[i - 1] ?? "";
    const shouldMerge = shouldMergeLines(prevLine, line);

    if (shouldMerge) {
      const separator = needsSpaceSeparator(prevLine, line) ? " " : "";
      currentLine += separator + line;
    } else {
      result.push(currentLine);
      currentLine = line;
    }
  }

  if (currentLine !== "") {
    result.push(currentLine);
  }

  return result;
}

/**
 * Processes text for quote buffering by:
 * 1. Detecting if 2nd+ lines have no leading whitespace (Pattern A) or all lines have common leading whitespace (Pattern B)
 * 2. Pattern A: Remove only leading whitespace, preserve all line breaks
 * 3. Pattern B: Remove common leading whitespace and merge lines (with exceptions)
 * 4. Adding quote prefix ("> ") to each line
 * 5. Adding two newlines at the end
 */
export function processQuoteText(text: string): string {
  const lines = text.split("\n");

  // Pattern detection: Check if any 2nd+ line has no leading whitespace
  const hasNoLeadingWhitespaceInLaterLines = lines
    .slice(1)
    .some(
      (line) =>
        line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t"),
    );

  let processedLines: string[];

  if (hasNoLeadingWhitespaceInLaterLines) {
    // Pattern A: Preserve line breaks, only remove leading whitespace
    processedLines = lines.map((line) => line.trimStart());
  } else {
    // Pattern B: Remove common leading whitespace and merge lines
    processedLines = removeWhitespaceAndMergeLines(lines);
  }

  // Add quote prefix to each line and join with newlines
  const quoted = processedLines.map((line) => `> ${line}`).join("\n");

  // Add two newlines at the end
  return `${quoted}\n\n`;
}
