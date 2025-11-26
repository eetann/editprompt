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
 * Merge lines for Pattern A where indented lines likely indicate wrap
 */
function mergeIndentedContinuations(
  originalLines: string[],
  trimmedLines: string[],
): string[] {
  const result: string[] = [];

  for (let i = 0; i < trimmedLines.length; i++) {
    const line = trimmedLines[i] ?? "";
    const original = originalLines[i] ?? "";
    const prevOriginal = originalLines[i - 1] ?? "";

    if (
      i > 0 &&
      original.startsWith(" ") &&
      original.trimStart().length > 0 &&
      !prevOriginal.startsWith(" ") &&
      !/^[-*+]\s/.test(original.trimStart()) // don't merge nested lists
    ) {
      const prev = result.pop() ?? "";
      const separator = needsSpaceSeparator(prev, line) ? " " : "";
      result.push(prev + separator + line);
      continue;
    }

    result.push(line);
  }

  return result;
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
  let trimmedLines = lines.map((line) => {
    if (line.length === 0) return line;
    return line.slice(minWhitespace);
  });

  // Handle wrapped continuation lines even when other lines are not indented.
  // Condition: previous line is not indented, current line is indented, and
  // current line is not a list item after trimming.
  trimmedLines = trimmedLines.map((line, index) => {
    const original = lines[index] ?? "";
    const prevOriginal = lines[index - 1] ?? "";
    const isContinuation =
      index > 0 &&
      original.startsWith(" ") &&
      original.trimStart().length > 0 &&
      prevOriginal.trim().length > 0 &&
      !/^[-*+]\s/.test(original.trimStart());

    if (isContinuation) {
      return original.trimStart().trimEnd();
    }

    return line.trimEnd();
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
export function processQuoteText(
  text: string,
  options?: { withQuote?: boolean },
): string {
  const withQuote = options?.withQuote ?? true;

  // Remove leading and trailing newlines
  const trimmedText = text.replace(/^\n+|\n+$/g, "");
  const lines = trimmedText.split("\n");

  // Pattern detection: Check if any 2nd+ line has no leading whitespace
  const hasNoLeadingWhitespaceInLaterLines = lines
    .slice(1)
    .some(
      (line) =>
        line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t"),
    );

  let processedLines: string[];

  if (hasNoLeadingWhitespaceInLaterLines) {
    // Pattern A: Preserve line breaks, only remove leading whitespace,
    // but attempt to merge obviously wrapped continuation lines
    const trimmedLines = lines.map((line) => line.trimStart().trimEnd());
    processedLines = mergeIndentedContinuations(lines, trimmedLines);
  } else {
    // Pattern B: Remove common leading whitespace and merge lines
    processedLines = removeWhitespaceAndMergeLines(lines);
  }

  // Add quote prefix to each line and join with newlines
  if (!withQuote) {
    return processedLines.join("\n");
  }

  const quoted = processedLines.map((line) => `> ${line}`).join("\n");
  return `${quoted}\n\n`;
}
