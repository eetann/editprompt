import { beforeEach, describe, expect, test } from "bun:test";
import { dropStash, getStashContent, getStashList, pushStash } from "../../src/modes/stash";
import { conf } from "../../src/modules/conf";

beforeEach(() => {
  conf.clear();
});

describe("pushStash", () => {
  test("should save content to stash", async () => {
    const mux = "tmux";
    const targetPaneId = "123";
    const content = "test prompt";

    const key = await pushStash(mux, targetPaneId, content);

    const data = conf.get(`${mux}.targetPane.pane_${targetPaneId}.stash`);
    expect(data).toEqual({ [key]: content });
  });

  test("should add to existing stash when pushed multiple times", async () => {
    const mux = "tmux";
    const targetPaneId = "123";
    const content1 = "first prompt";
    const content2 = "second prompt";

    const key1 = await pushStash(mux, targetPaneId, content1);
    const key2 = await pushStash(mux, targetPaneId, content2);

    const data = conf.get(`${mux}.targetPane.pane_${targetPaneId}.stash`);
    expect(data).toEqual({ [key1]: content1, [key2]: content2 });
  });
});

describe("getStashList", () => {
  test("should return empty array when no stash exists", () => {
    const mux = "tmux";
    const targetPaneId = "123";

    const result = getStashList(mux, targetPaneId);

    expect(result).toEqual([]);
  });

  test("should return entries sorted by key descending", async () => {
    const mux = "tmux";
    const targetPaneId = "123";

    const key1 = await pushStash(mux, targetPaneId, "first");
    await new Promise((resolve) => setTimeout(resolve, 10));
    const key2 = await pushStash(mux, targetPaneId, "second");

    const result = getStashList(mux, targetPaneId);

    expect(result).toEqual([
      { key: key2, content: "second" },
      { key: key1, content: "first" },
    ]);
  });
});

describe("getStashContent", () => {
  test("should return latest entry when key is not specified", async () => {
    const mux = "tmux";
    const targetPaneId = "123";

    await pushStash(mux, targetPaneId, "first");
    await new Promise((resolve) => setTimeout(resolve, 10));
    await pushStash(mux, targetPaneId, "second");

    const result = getStashContent(mux, targetPaneId);

    expect(result).toBe("second");
  });

  test("should return specific entry when key is specified", async () => {
    const mux = "tmux";
    const targetPaneId = "123";

    const key1 = await pushStash(mux, targetPaneId, "first");
    await new Promise((resolve) => setTimeout(resolve, 10));
    await pushStash(mux, targetPaneId, "second");

    const result = getStashContent(mux, targetPaneId, key1);

    expect(result).toBe("first");
  });

  test("should return empty string when key does not exist", () => {
    const mux = "tmux";
    const targetPaneId = "123";

    const result = getStashContent(mux, targetPaneId, "non-existent-key");

    expect(result).toBe("");
  });
});

describe("dropStash", () => {
  test("should drop latest entry when key is not specified", async () => {
    const mux = "tmux";
    const targetPaneId = "123";

    const key1 = await pushStash(mux, targetPaneId, "first");
    await new Promise((resolve) => setTimeout(resolve, 10));
    await pushStash(mux, targetPaneId, "second");

    const result = dropStash(mux, targetPaneId);

    expect(result).toBe(true);
    const list = getStashList(mux, targetPaneId);
    expect(list).toEqual([{ key: key1, content: "first" }]);
  });

  test("should drop specific entry when key is specified", async () => {
    const mux = "tmux";
    const targetPaneId = "123";

    const key1 = await pushStash(mux, targetPaneId, "first");
    await new Promise((resolve) => setTimeout(resolve, 10));
    const key2 = await pushStash(mux, targetPaneId, "second");

    const result = dropStash(mux, targetPaneId, key1);

    expect(result).toBe(true);
    const list = getStashList(mux, targetPaneId);
    expect(list).toEqual([{ key: key2, content: "second" }]);
  });

  test("should return false when key does not exist", () => {
    const mux = "tmux";
    const targetPaneId = "123";

    const result = dropStash(mux, targetPaneId, "non-existent-key");

    expect(result).toBe(false);
  });
});
