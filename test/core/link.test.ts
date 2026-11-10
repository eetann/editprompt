import { describe, expect, test } from "bun:test";
import {
  clearEditorLink,
  EditorContextError,
  getEditorPaneId,
  getTargetPaneIds,
  isEditorPane,
  markAsEditorPane,
  resolveEditorContext,
} from "../../src/core/link";
import { createFakeBackend } from "../helpers/fakeBackend";

describe("editor links", () => {
  test("registers an editor pane with unique target panes", async () => {
    const backend = createFakeBackend();

    await markAsEditorPane(backend, "editor", ["t1", "t2", "t1"]);

    expect(await isEditorPane(backend, "editor")).toBe(true);
    expect(await getTargetPaneIds(backend, "editor")).toEqual(["t1", "t2"]);
    expect(await getEditorPaneId(backend, "t1")).toBe("editor");
    expect(await getEditorPaneId(backend, "t2")).toBe("editor");
  });

  test("clears the link on a target pane", async () => {
    const backend = createFakeBackend();
    await markAsEditorPane(backend, "editor", ["t1"]);

    await clearEditorLink(backend, "t1");

    expect(await getEditorPaneId(backend, "t1")).toBe("");
  });

  test("keeps a newer editor link when an older editor exits", async () => {
    const backend = createFakeBackend();
    await markAsEditorPane(backend, "old", ["t1"]);
    await markAsEditorPane(backend, "new", ["t1"]);

    await clearEditorLink(backend, "t1", "old");

    expect(await getEditorPaneId(backend, "t1")).toBe("new");
  });
});

describe("resolveEditorContext", () => {
  test("returns the current editor pane and its target panes", async () => {
    const backend = createFakeBackend();
    await markAsEditorPane(backend, "editor", ["t1", "t2"]);

    expect(await resolveEditorContext(backend)).toEqual({
      editorPaneId: "editor",
      targetPaneIds: ["t1", "t2"],
    });
  });

  test("rejects a pane that is not an editor pane", async () => {
    const backend = createFakeBackend();

    expect(resolveEditorContext(backend)).rejects.toThrow(
      new EditorContextError("Current pane is not an editor pane"),
    );
  });

  test("rejects an editor pane without target panes", async () => {
    const backend = createFakeBackend();
    await markAsEditorPane(backend, "editor", []);

    expect(resolveEditorContext(backend)).rejects.toThrow(
      "No target panes registered for this editor pane",
    );
  });
});
