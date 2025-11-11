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
