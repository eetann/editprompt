# 📝 editprompt

A CLI tool that lets you write prompts for CLI tools using your favorite text editor. Works seamlessly with Claude Code, Codex CLI, Gemini CLI, and any other CLI process.

https://github.com/user-attachments/assets/01bcda7c-7771-4b33-bf5c-629812d45cc4


## 🏆 Why editprompt?

- **🎯 Your Editor, Your Way**: Write prompts in your favorite editor with full syntax highlighting, plugins, and customizations
- **🚫 No Accidental Sends**: Never accidentally hit Enter and send an incomplete prompt again
- 🔄 **Reusable Prompts**: Save and iterate on prompts with `--always-copy`
- 📝 **Multi-line Commands**: Complex SQL queries, JSON payloads


## ✨ Features

- 🖊️ **Editor Integration**: Use your preferred text editor to write prompts
- 🖥️ **Multiplexer Support**: Send prompts directly to tmux or WezTerm sessions
- 🖥️ **Universal Terminal Support**: Works with any terminal via clipboard - no multiplexer required
- 📋 **Clipboard Fallback**: Automatically copies to clipboard if sending fails
- 📋 **Always Copy Option**: Copy to clipboard even after successful tmux delivery (`--always-copy`)


## 📦 Installation

```bash
# Install globally via npm
npm install -g editprompt

# Or use with npx
npx editprompt
```

## 🚀 Usage

- Run `editprompt` to open a temporary Markdown file in your editor
- Write your prompt comfortably with full editor features
- Save and close - it automatically:
  - Sends to tmux/wezterm panes if detected
  - Falls back to clipboard otherwise (works with **any terminal**)

```sh
editprompt
```

**Advanced usage:** You can also send content **without closing the editor** for faster iteration. See `Send Without Closing Editor` for details.


### 🖥️ Tmux Integration

**Split window version (with pane resume):**
```tmux
bind -n M-q run-shell '\
  editprompt --resume --target-pane #{pane_id} || \
  tmux split-window -v -l 10 -c "#{pane_current_path}" \
    "editprompt --editor nvim --always-copy --target-pane #{pane_id}"'
```

**How it works:**
- **First time**: Creates a new editor pane if one doesn't exist
- **Subsequent times**: Focuses the existing editor pane instead of creating a new one
- **Bidirectional**: Pressing the same keybinding from within the editor pane returns you to the original target pane

This allows you to toggle between your target pane and editor pane using the same keybinding (`M-q`).

**Benefits:**
- Prevents pane proliferation and keeps your window management simple
- Switch between your work pane and editor pane while preserving your editing content

**Popup version:**
```tmux
bind -n M-q run-shell 'tmux display-popup -E \
  -d "#{pane_current_path}" \
  -w 80% -h 65% \
  "editprompt --editor nvim --always-copy --target-pane #{pane_id}"'
```


### 🖼️ WezTerm Integration
```lua
{
    key = "q",
    mods = "OPT",
    action = wezterm.action_callback(function(window, pane)
        local target_pane_id = tostring(pane:pane_id())
        window:perform_action(
            act.SplitPane({
                direction = "Down",
                size = { Cells = 10 },
            }),
            pane
        )
        wezterm.time.call_after(1, function()
            window:perform_action(
                act.SendString(
                    string.format(
                        "editprompt --editor nvim --always-copy --mux wezterm --target-pane %s\n",
                        target_pane_id
                    )
                ),
                window:active_pane()
            )
        end)
    end),
},
```

### 💡 Basic Usage

```bash
# Use with your default editor (from $EDITOR)
editprompt

# Specify a different editor
editprompt --editor nvim
editprompt -e nvim

# Always copy to clipboard
editprompt --always-copy

# Show help
editprompt --help
```


## 📤 Send Without Closing Editor

While editprompt is running, you can send content to the target pane or clipboard without closing the editor. This allows you to iterate quickly on your prompts.

### Basic Usage

```bash
# Run this command from within your editor session
editprompt -- "your content here"
```

This sends the content to the target pane (or clipboard) while keeping your editor open, so you can continue editing and send multiple times.

### Neovim Integration Example

You can set up a convenient keybinding to send your buffer content:

```lua
-- Send buffer content while keeping the editor open
if vim.env.EDITPROMPT then
    vim.keymap.set("n", "<Space>x", function()
        vim.cmd("update")
        -- Get buffer content
        local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
        local content = table.concat(lines, "\n")

        -- Execute editprompt command
        vim.system(
            { "editprompt", "--", content },
            { text = true },
            function(obj)
                vim.schedule(function()
                    if obj.code == 0 then
                        -- Clear buffer on success
                        vim.api.nvim_buf_set_lines(0, 0, -1, false, {})
                        vim.cmd("silent write")
                    else
                        -- Show error notification
                        vim.notify("editprompt failed: " .. (obj.stderr or "unknown error"), vim.log.levels.ERROR)
                    end
                end)
            end
        )
    end, { silent = true, desc = "Send buffer content to editprompt" })
end
```

With this configuration:
1. Open editprompt using the tmux/wezterm keybinding mentioned above
2. Write your prompt in the editor
3. Press `<Space>x` to send the content to the target pane
4. The buffer is automatically cleared on success
5. Continue editing to send more content


## ⚙️ Configuration

### 📝 Editor Selection

editprompt respects the following editor priority:

1. `--editor/-e` command line option
2. `$EDITOR` environment variable  
3. Default: `vim`

### 🌍 Environment Variables

- `EDITOR`: Your preferred text editor

### 🔧 Editor Integration with EDITPROMPT

editprompt automatically sets `EDITPROMPT=1` when launching your editor. This allows you to detect when your editor is launched by editprompt and enable specific configurations or plugins.

#### 🔍 Example: Neovim Configuration

```lua
-- In your Neovim config (e.g., init.lua)
if vim.env.EDITPROMPT then
  vim.opt.wrap = true
  -- Load a specific colorscheme
  vim.cmd('colorscheme blue')
end
```

#### 🛠️ Setting Custom Environment Variables

You can also pass custom environment variables to your editor:

```bash
# Single environment variable
editprompt --env THEME=dark

# Multiple environment variables
editprompt --env THEME=dark --env FOO=fooooo

# Useful for editor-specific configurations
editprompt --env NVIM_CONFIG=minimal
```

---

## 🔧 Development

```bash
# Clone the repository
git clone https://github.com/eetann/editprompt.git
cd editprompt

# Install dependencies
bun install

# Build
bun run build

# Run tests
bun test

# Development mode
bun run dev
```

### 💻 Testing During Development

When developing, you can test the built `dist/index.js` directly:

```diff
- { "editprompt", "--", content },
+ { "node", vim.fn.expand("~/path/to/editprompt/dist/index.js"), "--", content },
```

This allows you to make changes, run `bun run build`, and test immediately without reinstalling globally.

## 🔍 Technical Details

### 🔄 Fallback Strategy

editprompt implements a robust fallback strategy:

1. **Tmux Integration**: Direct input to tmux panes (when available)
2. **Clipboard**: Copy content to clipboard with user notification
