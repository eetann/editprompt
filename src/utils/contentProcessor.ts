export function processContent(content: string): string {
  let processed = content.replace(/\n$/, "");
  if (/@[^\n]*$/.test(processed)) {
    processed += " ";
  }
  return processed;
}
