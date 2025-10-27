# Mode Implementation Details

This document provides technical details about how each mode works, including constraints and solutions for different terminal multiplexers.

---

## openEditor Mode

### Purpose

Launches an editor, waits for content to be written, and sends it to the target pane when the editor closes.

### Constraints and Solutions

#### tmux with `run-shell`
- **Constraint**: `run-shell` creates a new shell process that does not inherit environment variables like `$EDITOR` from the parent shell
- **Solution**: Explicitly specify the editor using `--editor nvim`

```tmux
# Environment variables are not inherited, so explicitly specify the editor
bind -n M-q run-shell 'editprompt --editor nvim --target-pane #{pane_id}'
```

#### WezTerm with `SplitPane`
- **Constraint**: `SplitPane` performs simple command execution without loading login shell configuration (PATH, etc.)
- **Solution**: Explicitly launch a login shell with `/bin/zsh -lc "editprompt ..."` to load environment variables and PATH

```lua
-- Use -lc flag to launch as login shell and load environment variables and PATH
SplitPane({
  command = {
    args = {
      "/bin/zsh",
      "-lc",
      "editprompt --editor nvim --target-pane " .. target_pane_id,
    },
  },
})
```

---

## resume Mode

### Purpose

Reuses existing editor panes and enables bidirectional focus switching between target and editor panes.

### Constraints and Solutions

This mode needs to maintain the relationship between editor panes and target panes, enabling bidirectional focus switching.

#### tmux Implementation
- **Solution**: Use tmux pane variables (`@variable`) to persist data
- **Variables used**:
  - `@editprompt_editor_pane`: Set on target pane, stores editor pane ID
  - `@editprompt_is_editor`: Set on editor pane, flag indicating it's an editor pane
  - `@editprompt_target_pane`: Set on editor pane, stores original target pane ID

```bash
# Save editor pane ID on target pane
tmux set-option -pt '${targetPaneId}' @editprompt_editor_pane '${editorPaneId}'

# Save flag and target pane ID on editor pane
tmux set-option -pt '${editorPaneId}' @editprompt_is_editor 1
tmux set-option -pt '${editorPaneId}' @editprompt_target_pane '${targetPaneId}'
```

While tmux's `run-shell` does not inherit environment variables, it can access pane variables like `#{pane_id}`, making this approach work seamlessly.

#### WezTerm Implementation
- **Constraint**: WezTerm's `run_child_process` does not inherit environment variables or PATH, requiring execution via `/bin/zsh -lc`
- **Constraint**: WezTerm does not have a pane variable mechanism like tmux
- **About OSC User Variables**: WezTerm supports [user variable definition via OSC 1337](https://wezfurlong.org/wezterm/shell-integration.html#user-vars), but this method **cannot be used for panes running active processes**
  - OSC user variables are meant to be set during shell prompt display and similar events; they cannot be set externally on target panes already running processes like Claude Code
  - Editor panes also run processes like nvim after launch, facing the same constraint
- **Solution**: Use the [Conf](https://github.com/sindresorhus/conf) library to persist data to the filesystem
  - `wezterm.targetPane.pane_${targetPaneId}`: Stores editor pane ID
  - `wezterm.editorPane.pane_${editorPaneId}`: Stores target pane ID

```typescript
// Use Conf library to save the relationship between target and editor panes
conf.set(`wezterm.targetPane.pane_${targetPaneId}`, {
  editorPaneId: editorPaneId,
});
conf.set(`wezterm.editorPane.pane_${editorPaneId}`, {
  targetPaneId: targetPaneId,
});
```

This approach enables bidirectional focus switching in WezTerm, similar to tmux.

---

## sendOnly Mode

### Purpose

Sends content to the target pane without opening an editor, designed to be executed from within an editor session.

### Mechanism

This mode is designed to be executed from within the editor, where environment variables are properly inherited.

#### Workflow
1. **When launching the editor in openEditor mode**:
   - The following environment variables are set when launching the editor:
     - `EDITPROMPT_TARGET_PANE`: Target pane ID
     - `EDITPROMPT_MUX`: Multiplexer to use (`tmux` or `wezterm`)
     - `EDITPROMPT_ALWAYS_COPY`: Clipboard copy configuration
     - `EDITPROMPT=1`: Flag indicating launched by editprompt

2. **When executing sendOnly mode from within the editor**:
   - Execute `editprompt -- "content"` from editors like Neovim
   - Inherits environment variables from the parent process (editor)
   - Reads `EDITPROMPT_TARGET_PANE` and other variables to send content to the original target pane

```lua
-- Example execution from Neovim
vim.system(
  { "editprompt", "--", content },
  { text = true },
  function(obj)
    -- Environment variables are properly inherited when executed from the editor
  end
)
```

### Benefits
- Send content multiple times without closing the editor
- Environment variable inheritance happens naturally, requiring no additional configuration or arguments
