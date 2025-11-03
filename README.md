# 📝 editprompt

A CLI tool that lets you write prompts for CLI tools using your favorite text editor. Works seamlessly with Claude Code, Codex CLI, Gemini CLI, and any other CLI process.

https://github.com/user-attachments/assets/01bcda7c-7771-4b33-bf5c-629812d45cc4


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

## 🚀 Usage

editprompt supports three main workflows to fit different use cases:

### Workflow 1: Basic - Write and Send

<!-- TODO: ここに「エディタを開いて書いて閉じると送信される」の図 -->

The simplest way to use editprompt:

1. Run `editprompt` to open your editor
2. Write your prompt
3. Save and close the editor
4. Content is automatically sent to the target pane or clipboard

Perfect for one-off prompts when you need more space than a terminal input line.

### Workflow 2: Interactive - Iterate with Editor Open

<!-- TODO: ここに「エディタを開きっぱなしで何度も送信できる」の図 -->

For iterating on prompts without constantly reopening the editor:

1. Set up a keybinding to open editprompt with `--resume` mode
2. Editor pane stays open between sends
3. Write, send, refine, send again - all without closing the editor
4. Use the same keybinding to toggle between your work pane and editor pane

Ideal for trial-and-error workflows with AI assistants.

### Workflow 3: Quote - Collect and Reply

<!-- TODO: ここに「テキストを選択して蓄積→取り出して編集→送信」の図 -->

For replying to specific parts of AI responses:

1. Select text in tmux copy mode and pipe it to `editprompt --quote`
2. Repeat to collect multiple selections
3. Run `editprompt --capture` to retrieve all collected quotes
4. Edit and send your reply with context

Perfect for addressing multiple points in long AI responses.


## ⚙️ Setup & Configuration

### Basic Setup

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

### Tmux Integration

```tmux
bind -n M-q run-shell '\
  editprompt --resume --target-pane #{pane_id} || \
  tmux split-window -v -l 10 -c "#{pane_current_path}" \
    "editprompt --editor nvim --always-copy --target-pane #{pane_id}"'
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
        "editprompt --resume --mux wezterm --target-pane %s",
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
                "editprompt --editor nvim --always-copy --mux wezterm --target-pane %s",
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
editprompt -- "your content here"
```

This sends the content to the target pane (or clipboard) while keeping your editor open, so you can continue editing and send multiple times.

#### Neovim Integration Example

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

**Usage:**
1. Open editprompt using the tmux/wezterm keybinding
2. Write your prompt in the editor
3. Press `<Space>x` to send the content to the target pane
4. The buffer is automatically cleared on success
5. Continue editing to send more content

### Quote Workflow Setup

#### Collecting Quotes in tmux Copy Mode

Add this keybinding to your `.tmux.conf` to collect selected text as quotes:

```tmux
bind-key -T copy-mode-vi C-e { send-keys -X pipe "editprompt --quote --target-pane #{pane_id}" }
```

**Usage:**
1. Enter tmux copy mode (`prefix + [`)
2. Select text using vi-mode keybindings
3. Press `Ctrl-e` to add the selection as a quote
4. Repeat to collect multiple quotes
5. All quotes are stored in a pane variable associated with the target pane

#### Capturing Collected Quotes

Run this command from within your editor pane to retrieve all collected quotes:

```bash
editprompt --capture
```

This copies all collected quotes to the clipboard and clears the buffer, ready for your reply.

**Complete workflow:**
1. AI responds with multiple points
2. Select each point in copy mode and press `Ctrl-e`
3. Open your editor pane and run `editprompt --capture`
4. Edit the quoted text with your responses
5. Send to AI

**How quote buffering works:**
- Quotes are stored in tmux pane variables, automatically cleaned up when the pane closes
- Text is intelligently processed: removes common indentation, handles line breaks smartly
- Each quote is prefixed with `> ` in markdown quote format
- Multiple quotes are separated with blank lines

#### Neovim Integration Example

You can set up a convenient keybinding to capture your quote content:
```lua
vim.keymap.set("n", "<Space>X", function()
  vim.cmd("update")

  vim.system({ "editprompt", "--capture" }, { text = true }, function(obj)
    vim.schedule(function()
      if obj.code == 0 then
        vim.cmd("silent write")
        -- Split stdout by lines
        local output_lines = vim.split(obj.stdout, "\n")

        local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
        local is_empty = #lines == 1 and lines[1] == ""

        if is_empty then
          -- If empty, overwrite from the beginning
          vim.api.nvim_buf_set_lines(0, 0, -1, false, output_lines)
          vim.cmd("normal 2j")
        else
          -- If not empty, append to the end
          table.insert(output_lines, 1, "")
          local line_count = vim.api.nvim_buf_line_count(0)
          vim.api.nvim_buf_set_lines(
            0,
            line_count,
            line_count,
            false,
            output_lines
          )
          vim.cmd("normal 4j")
        end

        vim.cmd("silent write")
      else
        vim.notify(
          "editprompt failed: " .. (obj.stderr or "unknown error"),
          vim.log.levels.ERROR
        )
      end
    end)
  end)
end, { silent = true, desc = "Capture from editprompt quote mode" })
```

### Environment Variables

#### Editor Selection

editprompt respects the following editor priority:

1. `--editor/-e` command line option
2. `$EDITOR` environment variable
3. Default: `vim`

#### EDITPROMPT Environment Variable

editprompt automatically sets `EDITPROMPT=1` when launching your editor. This allows you to detect when your editor is launched by editprompt and enable specific configurations or plugins.

**Example: Neovim Configuration**

```lua
-- In your Neovim config (e.g., init.lua)
if vim.env.EDITPROMPT then
  vim.opt.wrap = true
  -- Load a specific colorscheme
  vim.cmd('colorscheme blue')
end
```

#### Custom Environment Variables

You can also pass custom environment variables to your editor:

```bash
# Single environment variable
editprompt --env THEME=dark

# Multiple environment variables
editprompt --env THEME=dark --env FOO=fooooo

# Useful for editor-specific configurations
editprompt --env NVIM_CONFIG=minimal
```

#### Target Pane Environment Variable

When using the send-without-closing feature or quote capture, editprompt sets `EDITPROMPT_TARGET_PANE` to the target pane ID. This is automatically used by `editprompt --` and `editprompt --capture` commands.

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

#### Neovim Configuration

```diff
- { "editprompt", "--", content },
+ { "node", vim.fn.expand("~/path/to/editprompt/dist/index.js"), "--", content },
```

#### WezTerm Configuration

```lua
-- In your wezterm.lua
local editprompt_cmd = "node " .. os.getenv("HOME") .. "/path/to/editprompt/dist/index.js"

{
    key = "e",
    mods = "OPT",
    action = wezterm.action_callback(function(window, pane)
        local target_pane_id = tostring(pane:pane_id())

        local success, stdout, stderr = wezterm.run_child_process({
            "/bin/zsh",
            "-lc",
            string.format(
                "%s --resume --mux wezterm --target-pane %s",
                editprompt_cmd,
                target_pane_id
            ),
        })

        if not success then
            window:perform_action(
                act.SplitPane({
                    -- ...
                    command = {
                        args = {
                            "/bin/zsh",
                            "-lc",
                            string.format(
                                "%s --editor nvim --always-copy --mux wezterm --target-pane %s",
                                editprompt_cmd,
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

#### tmux Configuration

```tmux
# In your .tmux.conf
set-option -g @editprompt-cmd "node ~/path/to/editprompt/dist/index.js"

bind-key -n M-q run-shell '\
  #{@editprompt-cmd} --resume --target-pane #{pane_id} || \
  tmux split-window -v -l 10 -c "#{pane_current_path}" \
    "#{@editprompt-cmd} --editor nvim --always-copy --target-pane #{pane_id}"'
```

This allows you to make changes, run `bun run build`, and test immediately without reinstalling globally.

## 🔍 Technical Details

### 🔄 Fallback Strategy

editprompt implements a robust fallback strategy:

1. **Tmux Integration**: Direct input to tmux panes (when available)
2. **Clipboard**: Copy content to clipboard with user notification
