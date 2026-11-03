import { beforeEach, describe, expect, test } from "bun:test";
import { conf } from "../../src/modules/conf";
import { weztermBackend } from "../../src/backends/wezterm";
import { appendQuote } from "../../src/core/quote";

beforeEach(() => {
  conf.clear();
});

describe("appendToQuoteText", () => {
  test("should create new quote_text when it doesn't exist", async () => {
    const paneId = "123";
    const content = "> foo\n\n";

    await appendQuote(weztermBackend, paneId, content);

    const data = conf.get(`wezterm.targetPane.pane_${paneId}`);
    expect(data).toEqual({ quote_text: content });
  });

  test("should append to existing quote_text with newline separator", async () => {
    const paneId = "123";
    const firstContent = "> foo\n\n";
    const secondContent = "> bar\n\n";

    await appendQuote(weztermBackend, paneId, firstContent);
    await appendQuote(weztermBackend, paneId, secondContent);

    const data = conf.get(`wezterm.targetPane.pane_${paneId}`);
    expect(data).toEqual({ quote_text: `${firstContent}\n\n${secondContent}` });
  });

  test("should preserve existing editorPaneId when appending quote_text", async () => {
    const paneId = "123";
    const editorPaneId = "456";
    const content = "> foo\n\n";

    // First, set editorPaneId
    conf.set(`wezterm.targetPane.pane_${paneId}`, { editorPaneId });

    // Then append quote_text
    await appendQuote(weztermBackend, paneId, content);

    const data = conf.get(`wezterm.targetPane.pane_${paneId}`);
    expect(data).toEqual({ editorPaneId, quote_text: content });
  });
});

describe("getQuoteText", () => {
  test("should get quote_text when it exists", async () => {
    const paneId = "123";
    const content = "> foo\n\n";

    conf.set(`wezterm.targetPane.pane_${paneId}`, { quote_text: content });

    const result = await weztermBackend.state.getQuote(paneId);
    expect(result).toBe(content);
  });

  test("should return empty string when quote_text doesn't exist", async () => {
    const paneId = "123";

    const result = await weztermBackend.state.getQuote(paneId);
    expect(result).toBe("");
  });
});

describe("clearQuoteText", () => {
  test("should delete only quote_text field", async () => {
    const paneId = "123";
    const content = "> foo\n\n";

    conf.set(`wezterm.targetPane.pane_${paneId}`, { quote_text: content });

    await weztermBackend.state.removeQuote(paneId);

    expect(conf.has(`wezterm.targetPane.pane_${paneId}`)).toBe(false);
  });

  test("should preserve editorPaneId when clearing quote_text", async () => {
    const paneId = "123";
    const editorPaneId = "456";
    const content = "> foo\n\n";

    conf.set(`wezterm.targetPane.pane_${paneId}`, {
      editorPaneId,
      quote_text: content,
    });

    await weztermBackend.state.removeQuote(paneId);

    const data = conf.get(`wezterm.targetPane.pane_${paneId}`);
    expect(data).toEqual({ editorPaneId });
  });
});
