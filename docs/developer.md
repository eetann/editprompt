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

### 📋 Logging

editprompt uses [LogTape](https://logtape.org/) for structured logging.

- **stderr output**: ANSI-colored format with timestamp (`getAnsiColorFormatter()`)
- **File output**: Plain text format with timestamp (`getTextFormatter()`)

Log level resolution for stderr:

1. `--quiet` → `null` (all logs dropped)
2. `--verbose` → `"debug"`
3. `EDITPROMPT_LOG_LEVEL` env var → parsed level
4. Default → `"info"`

File log level follows the same logic but ignores `--quiet` (file logging is always active if a path is configured).

### 🧩 Backend Architecture

Modes never branch on a multiplexer name. Each backend implements `MuxBackend` (`src/backends/types.ts`) and is looked up through the registry (`src/backends/registry.ts`):

- **Transport**: `getCurrentPaneId`, `paneExists`, `focusPane`, `sendText` (one chunk), `sendKey`, and `maxChunkBytes`
- **Behavior knobs**: `defaultSubmitKey`, `quoteSeparator`, `collectInput`, `storageNamespace()`
- **State**: a `PaneStateStore`, either `paneVariableStore` (tmux pane options, niwaterm tab variables) or `confStore` (WezTerm, Herdr, Rex, configured backends). Both keep the storage keys earlier versions wrote
- **Capabilities**: `splitPane`, `runInPane` and `closePane`, which `toggle` requires

Linking editor and target panes, the quote buffer, resume focus switching and chunked delivery are written once in `src/core/`.

To add a built-in backend, write the CLI calls in `src/modules/<name>.ts`, define the backend in `src/backends/<name>.ts`, and add it to `BUILTIN_BACKENDS` in the registry. Backends declared in the user's configuration file are built by `src/backends/command.ts`; see [backends.md](backends.md).

### 🔄 Fallback Strategy

editprompt implements a robust fallback strategy:

1. **Multiplexer Integration**: Direct input to the target panes through the selected backend (when available)
2. **Clipboard**: Copy content to clipboard with user notification
