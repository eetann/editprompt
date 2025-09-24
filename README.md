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

1. Run `editprompt` to open a temporary Markdown file in your editor
2. Write your prompt and save the file
3. Your prompt is automatically sent to the target pane or copied to clipboard if no pane is found

editprompt works with **any terminal** - no special setup required!

```sh
# Just run it - content will be copied to clipboard
editprompt
# Then paste (Ctrl+V / Cmd+V) into any CLI tool:
# - Claude Code
# - Codex
# - Any REPL or interactive prompt
```

Optional integrations (Tmux/Wezterm) provide seamless auto-send.


### 🖥️ Tmux Integration

**Split window version:**
```tmux
bind -n M-q run-shell 'tmux split-window -v -l 20 \
-c "#{pane_current_path}" \
"editprompt --editor nvim --always-copy --target-pane #{pane_id}"'
```

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



## ⚙️ Configuration

### 📝 Editor Selection

editprompt respects the following editor priority:

1. `--editor/-e` command line option
2. `$EDITOR` environment variable  
3. Default: `nvim`

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

### 📁 Project Structure

```
src/
├── config/
│   └── constants.ts          # Configuration constants
├── modules/
│   ├── editor.ts             # Editor launching and file handling
│   ├── process.ts            # Process detection and communication
│   └── selector.ts           # Interactive process selection
├── utils/
│   └── tempFile.ts           # Temporary file management
└── index.ts                  # CLI entry point
```

## 🔍 Technical Details

### 🔄 Fallback Strategy

editprompt implements a robust fallback strategy:

1. **Tmux Integration**: Direct input to tmux panes (when available)
2. **Clipboard**: Copy content to clipboard with user notification
