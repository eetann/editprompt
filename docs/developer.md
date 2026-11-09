## 🔧 Development

```bash
git clone https://github.com/eetann/editprompt.git
cd editprompt
bun install

bun run build      # or `bun run dev` to rebuild on change
bun run test
bun run lint
bun run typecheck
```

For the architecture and the rules the code relies on, see [AGENTS.md](../AGENTS.md). For the multiplexer constraints behind the implementation, see [modes.md](modes.md).

### 💻 Trying a Local Build

Point your configuration at the built `dist/index.js` instead of the installed `editprompt`, then run `bun run build` after each change.

tmux:

```tmux
set-option -g @editprompt-cmd "node ~/path/to/editprompt/dist/index.js"

bind -n M-q run-shell '\
  #{@editprompt-cmd} resume --target-pane #{pane_id} || \
  tmux split-window -v -l 10 -c "#{pane_current_path}" \
    "#{@editprompt-cmd} open --editor nvim --always-copy --target-pane #{pane_id}"'
```

For other terminals and editor integrations, replace `editprompt` with `node ~/path/to/editprompt/dist/index.js` the same way.
