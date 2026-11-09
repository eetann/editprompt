import { describe, expect, test } from "bun:test";
import { appendQuote, takeQuote } from "../../src/core/quote";
import { createFakeBackend } from "../helpers/fakeBackend";

describe("quote buffer", () => {
  test("joins quotes with the backend's separator", async () => {
    const tmuxLike = createFakeBackend("a", { quoteSeparator: "\n" });
    const weztermLike = createFakeBackend("b", { quoteSeparator: "\n\n" });

    for (const backend of [tmuxLike, weztermLike]) {
      await appendQuote(backend, "t1", "> first\n\n");
      await appendQuote(backend, "t1", "> second\n\n");
    }

    expect(await takeQuote(tmuxLike, "t1")).toBe("> first\n\n\n> second\n\n");
    expect(await takeQuote(weztermLike, "t1")).toBe("> first\n\n\n\n> second\n\n");
  });

  test("does not prepend a separator to a blank buffer", async () => {
    const backend = createFakeBackend();
    await backend.state.setQuote("t1", "\n");

    await appendQuote(backend, "t1", "> first\n\n");

    expect(await backend.state.getQuote("t1")).toBe("> first\n\n");
  });

  test("clears the buffer when it is taken", async () => {
    const backend = createFakeBackend();
    await appendQuote(backend, "t1", "> first\n\n");

    expect(await takeQuote(backend, "t1")).toBe("> first\n\n");
    expect(await takeQuote(backend, "t1")).toBe("");
  });
});
