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
    const backend = createFakeBackend("fake", { resumeAcceptsEditorPane: true });
    await markAsEditorPane(backend, "editor", ["t1"]);
    backend.currentPaneId = "elsewhere";
    backend.livePanes.add("t1");

    expect(await switchEditorFocus(backend, "editor")).toBe(true);
    expect(backend.calls).toEqual([["focusPane", "t1"]]);
  });

  test("ignores an editor pane passed as the target unless the backend allows it", async () => {
    const backend = createFakeBackend();
    await markAsEditorPane(backend, "editor", ["t1"]);
    backend.currentPaneId = "elsewhere";
    backend.livePanes.add("t1");

    expect(await switchEditorFocus(backend, "editor")).toBe(false);
    expect(backend.calls).toEqual([]);
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

  test("traces each step when asked to", async () => {
    const backend = createFakeBackend();
    await markAsEditorPane(backend, "editor", ["t1"]);
    backend.currentPaneId = "t1";
    const messages: string[] = [];

    expect(await switchEditorFocus(backend, "t1", (message) => messages.push(message))).toBe(false);
    expect(messages).toEqual([
      "Current pane is not an editor pane",
      "fake editorPaneId: {editorPaneId}",
      "Editor pane does not exist",
    ]);

    messages.length = 0;
    backend.currentPaneId = "editor";
    expect(await switchEditorFocus(backend, "t1", (message) => messages.push(message))).toBe(false);
    expect(messages).toEqual(["Current pane is an editor pane", "All target panes do not exist"]);
  });
});
