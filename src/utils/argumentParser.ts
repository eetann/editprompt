/**
 * Extract raw content from CLI arguments
 * Prioritizes ctx.rest (for -- separator) over ctx.positionals
 *
 * @param rest - Arguments passed after -- separator
 * @param positionals - Positional arguments
 * @returns Raw content string or undefined if no content provided
 */
export function extractRawContent(rest: string[], positionals: string[]): string | undefined {
  if (rest.length > 0) {
    const joined = rest.join(" ");
    if (joined.trim() !== "") {
      return joined;
    }
  }
  const first = positionals[0];
  if (first !== undefined && first.trim() !== "") {
    return first;
  }
  return undefined;
}
