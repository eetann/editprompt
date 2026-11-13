import { describe, expect, test } from "bun:test";
import { readSuggestions } from "../../src/modes/suggestion";
import { createFakeBackend } from "../helpers/fakeBackend";

describe("readSuggestions", () => {
  test("joins the suggestions of the target panes that have one", async () => {
    const backend = createFakeBackend();
    await backend.state.setSuggestion("t1", "run the tests");
    await backend.state.setSuggestion("t3", "commit it");

    expect(await readSuggestions(backend, ["t1", "t2", "t3"])).toBe("run the tests\ncommit it");
  });

  test("leaves the suggestion in place", async () => {
    const backend = createFakeBackend();
    await backend.state.setSuggestion("t1", "run the tests");

    await readSuggestions(backend, ["t1"]);

    expect(await readSuggestions(backend, ["t1"])).toBe("run the tests");
  });

  test("returns an empty string when no target pane has one", async () => {
    const backend = createFakeBackend();

    expect(await readSuggestions(backend, ["t1"])).toBe("");
  });
});
