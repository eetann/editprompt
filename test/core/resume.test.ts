import { describe, expect, test } from "bun:test";
import { getEditorPaneId, markAsEditorPane } from "../../src/core/link";
import { switchEditorFocus } from "../../src/core/resume";
import { createFakeBackend } from "../helpers/fakeBackend";

describe("switchEditorFocus", () => {
  test("focuses the editor pane from its target pane", async () => {
    const backend = createFakeBackend();
    await markAsEditorPane(backend, "editor", ["t1"]);
    backend.currentPaneId = "t1";
    backend.livePanes.add("editor");

    expect(await switchEditorFocus(backend, "t1")).toBe(true);
    expect(backend.calls).toEqual([["focusPane", "editor"]]);
  });

  test("focuses the first live target pane from the editor pane", async () => {
    const backend = createFakeBackend();
    await markAsEditorPane(backend, "editor", ["t1", "t2"]);
    backend.livePanes.add("t2");

    expect(await switchEditorFocus(backend, "t1")).toBe(true);
    expect(backend.calls).toEqual([["focusPane", "t2"]]);
  });

  test("treats a target pane argument that is an editor pane as the editor", async () => {
    const backend = createFakeBackend();
    await markAsEditorPane(backend, "editor", ["t1"]);
    backend.currentPaneId = "elsewhere";
    backend.livePanes.add("t1");

    expect(await switchEditorFocus(backend, "editor")).toBe(true);
    expect(backend.calls).toEqual([["focusPane", "t1"]]);
  });

  test("returns false when no target pane of the editor is alive", async () => {
    const backend = createFakeBackend();
    await markAsEditorPane(backend, "editor", ["t1"]);

    expect(await switchEditorFocus(backend, "t1")).toBe(false);
    expect(backend.calls).toEqual([]);
  });

  test("forgets an editor pane that no longer exists", async () => {
    const backend = createFakeBackend();
    await markAsEditorPane(backend, "editor", ["t1"]);
    backend.currentPaneId = "t1";

    expect(await switchEditorFocus(backend, "t1")).toBe(false);
    expect(await getEditorPaneId(backend, "t1")).toBe("");
  });

  test("returns false when no editor pane is registered", async () => {
    const backend = createFakeBackend();
    backend.currentPaneId = "t1";

    expect(await switchEditorFocus(backend, "t1")).toBe(false);
  });
});
