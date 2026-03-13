import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockSendKeyToTmuxPane = mock(() => Promise.resolve());
const mockGetCurrentPaneId = mock(() => Promise.resolve("%0"));
const mockIsEditorPane = mock(() => Promise.resolve(true));
const mockGetTargetPaneIds = mock(() => Promise.resolve(["%1", "%2"]));
const mockFocusTmuxPane = mock(() => Promise.resolve());

mock.module("../../src/modules/tmux", () => ({
  getCurrentPaneId: mockGetCurrentPaneId,
  isEditorPane: mockIsEditorPane,
  getTargetPaneIds: mockGetTargetPaneIds,
  sendKeyToTmuxPane: mockSendKeyToTmuxPane,
  focusPane: mockFocusTmuxPane,
}));

import { runPressMode } from "../../src/modes/press";

describe("runPressMode", () => {
  beforeEach(() => {
    mockSendKeyToTmuxPane.mockClear();
    mockGetCurrentPaneId.mockClear();
    mockIsEditorPane.mockClear();
    mockGetTargetPaneIds.mockClear();
    mockFocusTmuxPane.mockClear();

    process.env.EDITPROMPT_MUX = "tmux";
    process.env.EDITPROMPT_ALWAYS_COPY = "0";
    process.env.EDITPROMPT_SEND_KEY_DELAY = "0";
  });

  test("should exit with error when key is empty", async () => {
    const mockExit = mock(() => {});
    process.exit = mockExit as never;

    await runPressMode("", 0);

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test("should send key to all target panes", async () => {
    mockGetCurrentPaneId.mockResolvedValue("%0");
    mockIsEditorPane.mockResolvedValue(true);
    mockGetTargetPaneIds.mockResolvedValue(["%1", "%2"]);

    await runPressMode("Tab", 0);

    expect(mockSendKeyToTmuxPane).toHaveBeenCalledTimes(2);
    expect(mockSendKeyToTmuxPane).toHaveBeenCalledWith("%1", "Tab", 0);
    expect(mockSendKeyToTmuxPane).toHaveBeenCalledWith("%2", "Tab", 0);
  });

  test("should exit with error when all panes fail", async () => {
    const mockExit = mock(() => {});
    process.exit = mockExit as never;
    mockGetCurrentPaneId.mockResolvedValue("%0");
    mockIsEditorPane.mockResolvedValue(true);
    mockGetTargetPaneIds.mockResolvedValue(["%1", "%2"]);
    mockSendKeyToTmuxPane.mockRejectedValue(new Error("pane not found"));

    await runPressMode("Tab", 0);

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test("should not change focus after sending key", async () => {
    mockGetCurrentPaneId.mockResolvedValue("%0");
    mockIsEditorPane.mockResolvedValue(true);
    mockGetTargetPaneIds.mockResolvedValue(["%1"]);

    await runPressMode("1", 0);

    expect(mockFocusTmuxPane).not.toHaveBeenCalled();
  });
});
