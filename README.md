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
- 🖥️ **Multiplexer Support**: Send prompts directly to tmux, WezTerm, Herdr, or Rex sessions
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

1. Select text in your terminal and trigger collect mode
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

### Herdr Integration

Herdr v0.7.5 or later exposes the pane environment and socket API used by editprompt. Add a custom command to `~/.config/herdr/config.toml`:

```toml
[[keys.command]]
key = "prefix+e"
type = "shell"
command = 'editprompt toggle --mux herdr --target-pane "$HERDR_ACTIVE_PANE_ID" --editor nvim --always-copy --pane-rows 12'
description = "open prompt editor"
```

Run the binding from a target pane. editprompt opens a regular bottom split for the editor; after content is sent, it focuses the target pane again. If an editor pane is already registered, the command focuses that pane instead. Run the same binding from the editor pane to return to the first available target pane without sending content.

`--pane-rows` sets the desired editor height. Herdr limits split ratios to 10–90%, so editprompt uses the requested row count when possible and clamps it to those limits for very short or tall panes. The editor process replaces the split pane's shell, so the pane closes when the editor exits.

Inside a Herdr pane, editprompt automatically selects the Herdr backend when `HERDR_SOCKET_PATH` and a pane ID are available. An explicit `--mux` option or `EDITPROMPT_MUX` value takes precedence, so the binding above keeps `--mux herdr` to make its intent clear.

### Rex Integration

[Rex](https://www.superlogical.com/rex/docs) is configured in Lua, and its configuration file can both run commands and build layouts, so the binding does the splitting and editprompt only opens the editor. Add this to `~/.config/rex/init.lua`:

```lua
-- Height of the editor pane, in rows. new_split takes a fraction, so it is
-- derived from the target pane's current height; a fixed fraction would make
-- the editor grow with the window. PANE_CHROME_ROWS is what a pane spends on
-- its header and border, which hold no text.
local EDITOR_ROWS = 12
local PANE_CHROME_ROWS = 3

local function editor_ratio(block_id)
  local size = rex.block.call("com.superlogical.terminal", "size", { block_id = block_id })
  local rows = size and size.rows
  if not rows or rows <= 1 then
    return 0.8
  end
  -- Never let the editor take more than half, for a pane too short to spare the
  -- rows, and stay inside the fraction new_split accepts.
  return math.max(0.5, math.min(0.9, 1 - (EDITOR_ROWS + PANE_CHROME_ROWS) / rows))
end

-- Start the editor in the directory the target pane last reported. A shell that
-- uses OSC 7, such as nushell, reports it as a file:// URL.
local function pane_cwd(block_id)
  local result = rex.block.call("com.superlogical.terminal", "pwd", { block_id = block_id })
  local pwd = result and result.pwd
  if not pwd then
    return nil
  end
  return (pwd:gsub("^file://[^/]*", ""))
end

rex.bind("alt+q", function(ctx)
  -- Focus an editor pane that is already open, or, when pressed from the editor
  -- pane, go back to the target pane.
  local resumed, err = rex.exec({
    "editprompt", "resume", "--mux", "rex", "--target-pane", ctx.block_id,
  })
  if not resumed then
    -- The command never ran at all, which is not the same as having no editor
    -- pane to go back to. Say so rather than opening a split that would fail
    -- the same way.
    rex.log("error", "editprompt could not be run: " .. tostring(err))
    return true
  end
  if resumed.ok then
    return true
  end

  rex.session.new_split{
    anchor_id = ctx.block_id,
    direction = "vertical",
    side = "after",
    ratio = editor_ratio(ctx.block_id),
    focus = true,
    layout = rex.layout.block{
      flavor = "com.superlogical.terminal.shell",
      options = {
        command = {
          "editprompt", "open", "--mux", "rex",
          "--target-pane", ctx.block_id, "--editor", "nvim", "--always-copy",
        },
        cwd = pane_cwd(ctx.block_id),
      },
    },
  }
  return true
end)
```

Reload it with `rex config reload`; Rex does not watch the file for changes. `rex config check` reports mistakes without applying them.

`ratio` is the share the `before` part keeps, which here is the target pane, so a larger value leaves the editor less room. `direction = "vertical"` stacks the panes and `side = "after"` puts the new one below. `EDITOR_ROWS` is the knob worth tuning: it keeps the editor the same height whatever the window's size, the way `--pane-rows` does for Herdr.

**Turn off the app's "Autobalance Splits" setting.** With it on, Rex equalises every pane as soon as a block is created, which discards the `ratio` the binding asked for and leaves the editor half the window. Setting the border afterwards with `session.resize_pane` does not help either: the equalisation lands after it. `focus` defaults to false, so the binding asks for it explicitly. The pane closes once the editor exits, which is Rex's default for a terminal started with a `command`; it stays open after a quick failure instead, so a startup error remains readable.

editprompt locates the `rex` CLI through `REX_BIN_DIR`, which Rex sets in every terminal it opens, and falls back to the PATH. That matters because the login shell can rebuild PATH and drop the directory Rex added. On NixOS and nix-darwin it does, and the fix Rex documents for that runs in interactive shells only, which a terminal started from `init.lua` is not.

`rex.exec` runs in the Rex server's environment rather than a shell's, so give `editprompt` an absolute path there if the server's PATH does not include it.

Name the editor with `--editor`. A terminal Rex starts gets the login shell's environment, not the interactive one, so `$EDITOR` is whatever that environment sets rather than what your prompt uses — on nix-darwin, for instance, it is `nano`.

Inside a Rex pane, editprompt automatically selects the Rex backend when `REX_BLOCK` is set. Running tmux inside a Rex pane sets both, and Rex wins, so pass `--mux tmux` or set `EDITPROMPT_MUX` for that case.

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
# WezTerm example: --send-key "\r"
# Herdr and Rex example: --send-key "enter"
```

This sends the content to the target pane (or clipboard) while keeping your editor open, so you can continue editing and send multiple times.

**Options:**

- `--auto-send`: Automatically sends the content and returns focus to your editor pane (requires multiplexer)
- `--send-key <key>`: Customize the key to send after content (requires `--auto-send`)
  - tmux format: `Enter` (default), `C-a`, etc.
  - WezTerm format: `\r` (default), `\x01`, etc.
  - Herdr format: `enter` (default), `ctrl+a`, etc.
  - Rex format: `enter` (default), `ctrl+a`, etc.

#### Neovim Integration

For Neovim users, we recommend using [editprompt.nvim](https://github.com/eetann/editprompt.nvim) for easy setup. For manual configuration, see [docs/neovim.md](docs/neovim.md).

### Key Sending (press)

Send individual key inputs to the target pane without leaving your editor. Useful for responding to AI agent selection prompts (e.g., choosing option 1, 2, 3, 4) without switching panes.

```bash
# Send a character key
editprompt press -- 1

# Send special keys (tmux examples)
editprompt press -- Tab
editprompt press -- Up
editprompt press -- C-m    # Enter
editprompt press -- C-c    # Ctrl+C

# Herdr and Rex examples
editprompt press -- enter
editprompt press -- ctrl+c

# Send with delay
editprompt press --delay 500 -- Tab
```

**Key differences from `input`:**

- No Enter key is automatically appended
- Focus stays on the editor pane (no pane switching)
- Designed for single key inputs, not text content

**Key notation** depends on your multiplexer:

| Key           | tmux          | WezTerm             | Herdr         | Rex           |
| ------------- | ------------- | ------------------- | ------------- | ------------- |
| Enter         | `C-m`         | `\r`                | `enter`       | `enter`       |
| Tab           | `Tab`         | `\t`                | `tab`         | `tab`         |
| Escape        | `Escape`      | `\x1b`              | `esc`         | `escape`      |
| Arrow Up/Down | `Up` / `Down` | `\x1b[A` / `\x1b[B` | `up` / `down` | `up` / `down` |

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

#### Collecting Quotes in Herdr

Pass selected text as an argument together with the target pane ID:

```bash
editprompt collect --mux herdr --target-pane "$HERDR_PANE_ID" -- "selected text"
```

This can be called from a script or editor integration that has access to the selected text. Herdr quote buffers are stored in editprompt's configuration, associated with the target pane.

#### Collecting Quotes in Rex

Pass selected text as an argument together with the target block ID:

```bash
editprompt collect --mux rex --target-pane "$REX_BLOCK" -- "selected text"
```

From `init.lua`, call it with `rex.exec`, which takes an argv table so the text needs no quoting:

```lua
rex.exec({ "editprompt", "collect", "--mux", "rex", "--target-pane", ctx.block_id, "--", text })
```

As with Herdr, Rex quote buffers live in editprompt's configuration, associated with the target pane.

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
- **Herdr**: Quotes are stored in editprompt's configuration and associated with the pane ID
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

### Logging Options

editprompt uses structured logging via [LogTape](https://logtape.org/). The following flags are available on all subcommands:

| Flag                | Description                                |
| ------------------- | ------------------------------------------ |
| `--quiet` / `-q`    | Suppress all log output                    |
| `--verbose` / `-v`  | Enable debug-level log output              |
| `--log-file <path>` | Write logs to the specified file (appends) |

You can also configure logging via environment variables:

| Environment Variable   | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `EDITPROMPT_LOG_FILE`  | Path to log file (same as `--log-file`)              |
| `EDITPROMPT_LOG_LEVEL` | Log level (e.g. `debug`, `info`, `warning`, `error`) |

**Log level resolution priority:**

1. `--quiet` → suppresses all logs
2. `--verbose` → sets level to `debug`
3. `EDITPROMPT_LOG_LEVEL` → uses the specified level
4. Default: `info`

### Send-Key Delay

When using `--auto-send` with `editprompt input`, a delay is inserted before sending the key to allow the target process to finish processing the content.

| Environment Variable        | Description                                  | Default |
| --------------------------- | -------------------------------------------- | ------- |
| `EDITPROMPT_SEND_KEY_DELAY` | Delay in milliseconds before sending the key | `1000`  |

**Auto-detection:** editprompt automatically adjusts the delay based on content:

- **Content with image paths** → uses `EDITPROMPT_SEND_KEY_DELAY` (default: `1000` ms)
- **Content without image paths** → uses `200` ms

Supported image extensions: `.png`, `.webp`, `.avif`, `.jpg`/`.jpeg`, `.gif` (case-insensitive)
