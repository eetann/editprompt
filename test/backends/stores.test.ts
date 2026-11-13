import { beforeEach, describe, expect, test } from "bun:test";
import { confStore, paneVariableStore } from "../../src/backends/stores";
import { conf } from "../../src/modules/conf";

beforeEach(() => {
  conf.clear();
});

function createMemoryIO() {
  const values = new Map<string, string>();
  return {
    values,
    io: {
      get: async (paneId: string, name: string) => values.get(`${paneId}/${name}`) ?? "",
      set: async (paneId: string, name: string, value: string) => {
        values.set(`${paneId}/${name}`, value);
      },
    },
  };
}

describe("paneVariableStore", () => {
  test("uses the prefixed variable names on each pane", async () => {
    const { values, io } = createMemoryIO();
    const store = paneVariableStore(io, "@editprompt_");

    await store.setTargetPaneIds("%3", ["%1", "%2"]);
    await store.setEditorPaneId("%1", "%3");
    await store.setQuote("%1", "> quote\n\n");

    expect(Object.fromEntries(values)).toEqual({
      "%3/@editprompt_is_editor": "1",
      "%3/@editprompt_target_panes": "%1,%2",
      "%1/@editprompt_editor_pane": "%3",
      "%1/@editprompt_quote": "> quote\n\n",
    });
  });

  test("reads the state back, trimming IDs but not quotes", async () => {
    const { values, io } = createMemoryIO();
    const store = paneVariableStore(io, "@editprompt_");
    values.set("%3/@editprompt_is_editor", "1\n");
    values.set("%3/@editprompt_target_panes", "%1, %2\n");
    values.set("%1/@editprompt_editor_pane", "%3\n");
    values.set("%1/@editprompt_quote", "> quote\n\n");

    expect(await store.isEditorPane("%3")).toBe(true);
    expect(await store.isEditorPane("%1")).toBe(false);
    expect(await store.getTargetPaneIds("%3")).toEqual(["%1", "%2"]);
    expect(await store.getTargetPaneIds("%1")).toEqual([]);
    expect(await store.getEditorPaneId("%1")).toBe("%3");
    expect(await store.getQuote("%1")).toBe("> quote\n\n");
  });

  test("clears the link and quote by emptying the variables", async () => {
    const { values, io } = createMemoryIO();
    const store = paneVariableStore(io, "editprompt_");
    await store.setTargetPaneIds("t3", ["t1"]);
    await store.setEditorPaneId("t1", "t3");
    await store.setQuote("t1", "> quote\n\n");

    await store.removeEditorPaneId("t1");
    await store.removeQuote("t1");
    await store.removeEditorPane("t3");

    expect(values.get("t1/editprompt_editor_pane")).toBe("");
    expect(values.get("t1/editprompt_quote")).toBe("");
    // Pane variables die with the pane, so the editor marker is kept.
    expect(values.get("t3/editprompt_is_editor")).toBe("1");
  });

  test("keeps the suggestion in its own variable", async () => {
    const { values, io } = createMemoryIO();
    const store = paneVariableStore(io, "@editprompt_");

    await store.setSuggestion("%1", "run the tests");
    expect(values.get("%1/@editprompt_suggestion")).toBe("run the tests");
    expect(await store.getSuggestion("%1")).toBe("run the tests");

    await store.removeSuggestion("%1");
    expect(await store.getSuggestion("%1")).toBe("");
  });
});

describe("confStore", () => {
  test("keeps the existing Conf key layout", async () => {
    const store = confStore(() => "wezterm");

    await store.setTargetPaneIds("3", ["1", "2"]);
    await store.setEditorPaneId("1", "3");
    await store.setQuote("1", "> quote\n\n");

    expect(conf.get("wezterm.editorPane.pane_3")).toEqual({ targetPaneIds: ["1", "2"] });
    expect(conf.get("wezterm.targetPane.pane_1")).toEqual({
      editorPaneId: "3",
      quote_text: "> quote\n\n",
    });
  });

  test("reads state written by earlier versions", async () => {
    conf.set("rex.editorPane.pane_block:e", { targetPaneIds: ["block:t"] });
    conf.set("rex.targetPane.pane_block:t", { editorPaneId: "block:e", quote_text: "> q\n\n" });
    const store = confStore(() => "rex");

    expect(await store.isEditorPane("block:e")).toBe(true);
    expect(await store.getTargetPaneIds("block:e")).toEqual(["block:t"]);
    expect(await store.getEditorPaneId("block:t")).toBe("block:e");
    expect(await store.getQuote("block:t")).toBe("> q\n\n");
  });

  test("removes one field at a time and drops empty records", async () => {
    const store = confStore(() => "wezterm");
    await store.setEditorPaneId("1", "3");
    await store.setQuote("1", "> quote\n\n");

    await store.removeEditorPaneId("1");
    expect(conf.get("wezterm.targetPane.pane_1")).toEqual({ quote_text: "> quote\n\n" });

    await store.removeQuote("1");
    expect(conf.has("wezterm.targetPane.pane_1")).toBe(false);
  });

  test("keeps the suggestion beside the quote", async () => {
    const store = confStore(() => "wezterm");
    await store.setQuote("1", "> quote\n\n");
    await store.setSuggestion("1", "run the tests");

    expect(conf.get("wezterm.targetPane.pane_1")).toEqual({
      quote_text: "> quote\n\n",
      suggestion_text: "run the tests",
    });
    expect(await store.getSuggestion("1")).toBe("run the tests");

    await store.removeSuggestion("1");
    expect(conf.get("wezterm.targetPane.pane_1")).toEqual({ quote_text: "> quote\n\n" });
  });

  test("forgets an editor pane", async () => {
    const store = confStore(() => "wezterm");
    await store.setTargetPaneIds("3", ["1"]);

    await store.removeEditorPane("3");

    expect(await store.isEditorPane("3")).toBe(false);
    expect(await store.getTargetPaneIds("3")).toEqual([]);
  });

  test("resolves the namespace on every access", async () => {
    let namespace = "herdr.session_a";
    const store = confStore(() => namespace);
    await store.setEditorPaneId("w1:p1", "w1:p2");

    namespace = "herdr.session_b";
    expect(await store.getEditorPaneId("w1:p1")).toBe("");

    namespace = "herdr.session_a";
    expect(await store.getEditorPaneId("w1:p1")).toBe("w1:p2");
  });
});

describe("confStore with wholeTargetRecord (WezTerm)", () => {
  test("replaces the target record when linking, dropping the quote", async () => {
    const store = confStore(() => "wezterm", { wholeTargetRecord: true });
    await store.setQuote("1", "> quote\n\n");

    await store.setEditorPaneId("1", "3");

    expect(conf.get("wezterm.targetPane.pane_1")).toEqual({ editorPaneId: "3" });
  });

  test("deletes the whole target record when unlinking", async () => {
    const store = confStore(() => "wezterm", { wholeTargetRecord: true });
    conf.set("wezterm.targetPane.pane_1", { editorPaneId: "3", quote_text: "> quote\n\n" });

    await store.removeEditorPaneId("1");

    expect(conf.has("wezterm.targetPane.pane_1")).toBe(false);
  });

  test("leaves an empty record behind when clearing the quote", async () => {
    const store = confStore(() => "wezterm", { wholeTargetRecord: true });
    conf.set("wezterm.targetPane.pane_1", { quote_text: "> quote\n\n" });

    await store.removeQuote("1");

    expect(conf.get("wezterm.targetPane.pane_1")).toEqual({});
  });

  test("swallows storage failures", async () => {
    const store = confStore(
      () => {
        throw new Error("broken");
      },
      { wholeTargetRecord: true },
    );

    expect(await store.getEditorPaneId("1")).toBe("");
    expect(await store.isEditorPane("1")).toBe(false);
    expect(await store.getTargetPaneIds("1")).toEqual([]);
    await store.setTargetPaneIds("1", ["2"]);
  });
});
