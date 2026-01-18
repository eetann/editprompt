<p align="center">
    <a href="https://www.npmjs.com/package/editprompt"><img src="https://img.shields.io/npm/v/editprompt?color=CB0200" alt="link to npm.js" /></a>
</p>

# 📝 editprompt

A CLI tool that lets you write prompts for CLI tools using your favorite text editor. Works seamlessly with Claude Code, Codex CLI, Gemini CLI, and any other CLI process.

![send without closing editor](https://github.com/user-attachments/assets/b0e486af-78d7-4b70-8c82-64d330c22ba1)

> [!IMPORTANT]
> **📢 Migrating from v0.8.1 or earlier?** Please see the [Migration Guide](docs/migration-guide-v1.md) for upgrading to v1.0.0's subcommand-based interface.

## 🏆 Why editprompt?

- **🎯 Your Editor, Your Way**: Write prompts in your favorite editor with full syntax highlighting, plugins, and customizations
- **🚫 No Accidental Sends**: Never accidentally hit Enter and send an incomplete prompt again
- **🔄 Iterate Efficiently**: Keep your editor open and send multiple prompts without reopening
- **💬 Quote and Reply**: Collect multiple text selections and reply to specific parts of AI responses
- **📝 Multi-line Commands**: Complex SQL queries, JSON payloads, and structured prompts


## ✨ Features

- 🖊️ **Editor Integration**: Use your preferred text editor to write prompts
- 🖥️ **Multiplexer Support**: Send prompts directly to tmux or WezTerm sessions
- 🖥️ **Universal Terminal Support**: Works with any terminal via clipboard - no multiplexer required
- 📤 **Send Without Closing**: Iterate on prompts without closing your editor
- 📋 **Quote Buffering**: Collect text selections and send them as quoted replies
- 📋 **Clipboard Fallback**: Automatically copies to clipboard if sending fails


## 📦 Installation

```bash
# Install globally via npm
npm install -g editprompt

# Or use with npx
npx editprompt
```

### Neovim Plugin

For Neovim users, [editprompt.nvim](https://github.com/eetann/editprompt.nvim) provides easy integration. For manual configuration, see [docs/neovim.md](docs/neovim.md).

## 🚀 Usage

editprompt supports three main workflows to fit different use cases:

### Workflow 1: Basic - Write and Send

![wrihte and send prompt by editprompt](https://github.com/user-attachments/assets/6587b0c4-8132-4d5c-be68-3aa32a8d4df2)

The simplest way to use editprompt:

1. Run `editprompt open` to open your editor
2. Write your prompt
3. Save and close the editor
4. Content is automatically sent to the target pane or clipboard

Perfect for one-off prompts when you need more space than a terminal input line.

### Workflow 2: Interactive - Iterate with Editor Open

![send without closing editor](https://github.com/user-attachments/assets/b0e486af-78d7-4b70-8c82-64d330c22ba1)

For iterating on prompts without constantly reopening the editor:

1. Set up a keybinding to open editprompt with `resume` subcommand
2. Editor pane stays open between sends
3. Write, send, refine, send again - all without closing the editor
4. Use the same keybinding to toggle between your work pane and editor pane

Ideal for trial-and-error workflows with AI assistants.

### Workflow 3: Quote - Collect and Reply

![quote and capture with editprompt](https://github.com/user-attachments/assets/33af0702-5c80-4ccf-80d9-0ae42052e6fa)

```markdown
> Some AI agents include leading spaces in their output,which can make the copied text look a bit awkward.

<!-- Write your reply here -->

> Using editprompt’s quote mode or capture mode makes it easy to reply while quoting the AI agent’s output.

<!-- Write your reply here -->
```

For replying to specific parts of AI responses:

1. Select text in your terminal (tmux copy mode or WezTerm selection) and trigger collect mode
2. Repeat to collect multiple selections
3. Run `editprompt dump` to retrieve all collected quotes
4. Edit and send your reply with context

Perfect for addressing multiple points in long AI responses.


## ⚙️ Setup & Configuration

### Basic Setup

```bash
# Use with your default editor (from $EDITOR)
editprompt open

# Specify a different editor
editprompt open --editor nvim
editprompt open -e nvim

# Always copy to clipboard
editprompt open --always-copy

# Show help
editprompt --help
editprompt open --help
```

### Tmux Integration

```tmux
bind -n M-q run-shell '\
  editprompt resume --target-pane #{pane_id} || \
  tmux split-window -v -l 10 -c "#{pane_current_path}" \
    "editprompt open --editor nvim --always-copy --target-pane #{pane_id}"'
```


### WezTerm Integration

```lua
{
  key = "q",
  mods = "OPT",
  action = wezterm.action_callback(function(window, pane)
    local target_pane_id = tostring(pane:pane_id())

    -- Try to resume existing editor pane
    local success, stdout, stderr = wezterm.run_child_process({
      "/bin/zsh",
      "-lc",
      string.format(
        "editprompt resume --mux wezterm --target-pane %s",
        target_pane_id
      ),
    })

    -- If resume failed, create new editor pane
    if not success then
      window:perform_action(
        act.SplitPane({
          direction = "Down",
          size = { Cells = 10 },
          command = {
            args = {
              "/bin/zsh",
              "-lc",
              string.format(
                "editprompt open --editor nvim --always-copy --mux wezterm --target-pane %s",
                target_pane_id
              ),
            },
          },
        }),
        pane
      )
    end
  end),
},
```

**Note:** The `-lc` flag ensures your shell loads the full login environment, making `editprompt` available in your PATH.


### Editor Integration (Send Without Closing)

While editprompt is running, you can send content to the target pane or clipboard without closing the editor. This allows you to iterate quickly on your prompts.

#### Command Line Usage

```bash
# Run this command from within your editor session
editprompt input -- "your content here"
# Sends content to target pane and moves focus there

editprompt input --auto-send -- "your content here"
# Sends content, automatically submits it (presses Enter), and returns focus to editor pane
# Perfect for iterating on prompts without leaving your editor

editprompt input --auto-send --send-key "C-m" -- "your content here"
# Customize the key to send after content (tmux format example)
# WezTerm example: --send-key "\r" (default for WezTerm is \r, tmux default is Enter)
```

This sends the content to the target pane (or clipboard) while keeping your editor open, so you can continue editing and send multiple times.

**Options:**
- `--auto-send`: Automatically sends the content and returns focus to your editor pane (requires multiplexer)
- `--send-key <key>`: Customize the key to send after content (requires `--auto-send`)
  - tmux format: `Enter` (default), `C-a`, etc.
  - WezTerm format: `\r` (default), `\x01`, etc.

#### Neovim Integration

For Neovim users, we recommend using [editprompt.nvim](https://github.com/eetann/editprompt.nvim) for easy setup. For manual configuration, see [docs/neovim.md](docs/neovim.md).

### Quote Workflow Setup

#### Collecting Quotes in tmux Copy Mode

Add this keybinding to your `.tmux.conf` to collect selected text as quotes:

```tmux
bind-key -T copy-mode-vi C-e { send-keys -X pipe "editprompt collect --target-pane #{pane_id}" }
```

**Usage:**
1. Enter tmux copy mode (`prefix + [`)
2. Select text using vi-mode keybindings
3. Press `Ctrl-e` to add the selection as a quote
4. Repeat to collect multiple quotes
5. All quotes are stored in a pane variable associated with the target pane

#### Collecting Quotes in WezTerm

Add this event handler and keybinding to your `wezterm.lua` to collect selected text as quotes:

```lua
local wezterm = require("wezterm")

wezterm.on("editprompt-collect", function(window, pane)
  local text = window:get_selection_text_for_pane(pane)
  local target_pane_id = tostring(pane:pane_id())

  wezterm.run_child_process({
    "/bin/zsh",
    "-lc",
    string.format(
      "editprompt collect --mux wezterm --target-pane %s -- %s",
      target_pane_id,
      wezterm.shell_quote_arg(text)
    ),
  })
end)

return {
  keys = {
    {
      key = "e",
      mods = "CTRL",
      action = wezterm.action.EmitEvent("editprompt-collect"),
    },
  },
}
```

**Usage:**
1. Select text in WezTerm (by dragging with mouse or using copy mode)
2. Press `Ctrl-e` to add the selection as a quote
3. Repeat to collect multiple quotes
4. All quotes are stored in a configuration file associated with the target pane

#### Capturing Collected Quotes

Run this command from within your editor pane to retrieve all collected quotes:

```bash
editprompt dump
```

This copies all collected quotes to the clipboard and clears the buffer, ready for your reply.

**Complete workflow:**
1. AI responds with multiple points
2. Select each point in copy mode and press `Ctrl-e`
3. Open your editor pane and run `editprompt dump`
4. Edit the quoted text with your responses
5. Send to AI

**How quote buffering works:**
- **tmux**: Quotes are stored in pane variables, automatically cleaned up when the pane closes
- **WezTerm**: Quotes are stored in a configuration file associated with the pane
- Text is intelligently processed: removes common indentation, handles line breaks smartly
- Each quote is prefixed with `> ` in markdown quote format
- Multiple quotes are separated with blank lines

### Sending to Multiple Panes

You can send content to multiple target panes simultaneously by specifying `--target-pane` multiple times:

```bash
# Send to multiple panes with open subcommand
editprompt open --target-pane %1 --target-pane %2 --target-pane %3

# Register multiple target panes for use with resume and input modes
editprompt register --target-pane %1 --target-pane %2
```

The content will be sent sequentially to all specified panes. This is useful when you want to send the same prompt to multiple CLI sessions.

### Prompt Stash

Store prompts temporarily for later use, similar to `git stash`. This is useful when you want to save a prompt idea and use it later.

```bash
# Save a prompt to stash (must be run from editor pane)
editprompt stash push -- "your prompt here"

# List all stashed prompts (JSON output)
editprompt stash list

# Get the latest stashed prompt (outputs to stdout)
editprompt stash apply

# Get a specific stashed prompt by key
editprompt stash apply --key "2025-01-07T12:34:56.789Z"

# Remove the latest stashed prompt
editprompt stash drop

# Get and remove the latest stashed prompt (apply + drop)
editprompt stash pop
```

**Note:** The stash commands must be run from within an editprompt editor session (where `EDITPROMPT=1` is set). Stash data is associated with the target pane and persisted using the Conf library.

### Environment Variables

#### Editor Selection

editprompt respects the following editor priority:

1. `--editor/-e` command line option
2. `$EDITOR` environment variable
3. Default: `vim`

#### EDITPROMPT Environment Variable

editprompt automatically sets `EDITPROMPT=1` when launching your editor. This allows you to detect when your editor is launched by editprompt and enable specific configurations or plugins. For Neovim integration examples, see [docs/neovim.md](docs/neovim.md).

#### Custom Environment Variables

You can also pass custom environment variables to your editor:

```bash
# Single environment variable
editprompt open --env THEME=dark

# Multiple environment variables
editprompt open --env THEME=dark --env FOO=fooooo

# Useful for editor-specific configurations
editprompt open --env NVIM_CONFIG=minimal
```

#### Target Pane Environment Variable

When using the send-without-closing feature or dump, editprompt sets `EDITPROMPT_TARGET_PANE` to the target pane ID. This is automatically used by `editprompt input` and `editprompt dump` commands.
