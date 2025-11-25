import { describe, expect, test } from "bun:test";
import { processQuoteText } from "../../src/utils/quoteProcessor";

describe("processQuoteText", () => {
  test("Pattern A: should preserve line breaks when 2nd+ lines have no leading whitespace", () => {
    const input = "  foo\n  bar\nbaz";
    const expected = "> foo\n> bar\n> baz\n\n";
    expect(processQuoteText(input)).toBe(expected);
  });

  test("Pattern B: should join lines with single space when both ends are alphabetic", () => {
    const input = "  foo\n  bar\n  baz";
    const expected = "> foo bar baz\n\n";
    expect(processQuoteText(input)).toBe(expected);
  });

  test("Pattern B: should join lines without space when ends are not both alphabetic", () => {
    const input = "  fooはbar\n  ということが分かった";
    const expected = "> fooはbarということが分かった\n\n";
    expect(processQuoteText(input)).toBe(expected);
  });

  test("Pattern B: should preserve line breaks for Markdown list items", () => {
    const input =
      "  - fooって実は\n  barなんだ\n  - じつはhoge\n  piyoには秘密がある\n  - さらにbarは\n  buzなんだよ";
    const expected =
      "> - fooって実はbarなんだ\n> - じつはhoge piyoには秘密がある\n> - さらにbarはbuzなんだよ\n\n";
    expect(processQuoteText(input)).toBe(expected);
  });

  test("Pattern B: should preserve line breaks when both lines contain colons", () => {
    const input = "  key1: value1\n  key2: value2\n  key3: value3";
    const expected = "> key1: value1\n> key2: value2\n> key3: value3\n\n";
    expect(processQuoteText(input)).toBe(expected);
  });

  test("should add quote prefix to each line including empty lines and add two newlines at end", () => {
    const input = "  foo\n\n  bar";
    const expected = "> foo\n> \n> bar\n\n";
    expect(processQuoteText(input)).toBe(expected);
  });

  test("should remove leading and trailing newlines", () => {
    const input = "\n  foo\n  bar\n";
    const expected = "> foo bar\n\n";
    expect(processQuoteText(input)).toBe(expected);
  });

  test("should remove multiple leading and trailing newlines", () => {
    const input = "\n\n\n  foo\n  bar\n\n\n";
    const expected = "> foo bar\n\n";
    expect(processQuoteText(input)).toBe(expected);
  });

  test("should remove only leading newlines", () => {
    const input = "\n\n  foo\n  bar";
    const expected = "> foo bar\n\n";
    expect(processQuoteText(input)).toBe(expected);
  });

  test("should remove only trailing newlines", () => {
    const input = "  foo\n  bar\n\n";
    const expected = "> foo bar\n\n";
    expect(processQuoteText(input)).toBe(expected);
  });

  test("should trim leading spaces on wrapped continuation lines", () => {
    const input = "Line one wraps\n  and continues\n  even more";
    const expected = "> Line one wraps and continues even more\n\n";
    expect(processQuoteText(input)).toBe(expected);
  });

  test("should drop trailing spaces before wrapping", () => {
    const input = "- option --no-  \n  quote-behavior";
    const expected = "> - option --no-quote-behavior\n\n";
    expect(processQuoteText(input)).toBe(expected);
  });

  test("should merge indented continuation lines even when other lines are not indented", () => {
    const input = `- src/modes/collect.ts: allows buffer/stdout outputs and --no-
  quote to skip quoting while writing to stdout.
- another bullet`;
    const expected =
      "> - src/modes/collect.ts: allows buffer/stdout outputs and --no-quote to skip quoting while writing to stdout.\n> - another bullet\n\n";
    expect(processQuoteText(input)).toBe(expected);
  });

  test("should skip quote prefix and trailing newlines when withQuote is false", () => {
    const input = "\n  foo\n  bar\n\n";
    const expected = "foo bar";
    expect(processQuoteText(input, { withQuote: false })).toBe(expected);
  });
});
