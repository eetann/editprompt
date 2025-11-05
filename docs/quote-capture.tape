Output quote-capture.gif
Set Shell zsh
Set FontSize 14
Set Width 800
Set Height 500
Set Framerate 60
Set Padding 5
Set WindowBar Colorful
Set BorderRadius 10
Set FontFamily "HackGen Console NF"
Set Theme "Builtin Solarized Dark"

Hide
  Type@0 "tmux -L test kill-server" Enter
  Type@0 "tmux -f /dev/null -L test new-session -- zsh" Enter
  Type@0 'tmux set status' Enter
  Type@0 'tmux set -g pane-border-indicators both' Enter

  Type@0 'tmux set -g @editprompt-cmd "node ~/ghq/github.com/eetann/editprompt/dist/index.js"' Enter
  Type@0 `tmux bind -N 'editprompt' q run-shell '#{@editprompt-cmd} --resume --target-pane #{pane_id} || tmux split-window -v -l 10 -c "#{pane_current_path}" "#{@editprompt-cmd} --editor nvim --target-pane #{pane_id} --always-copy"'` Enter
  Type@0 'tmux set -gw mode-keys vi' Enter
  # {}の記法はzshだと使えない（文字列として認識できないため）
  Type@0 `tmux bind -T copy-mode-vi C-e 'send-keys -X pipe "#{@editprompt-cmd} --quote --target-pane #{pane_id}" ; display "quote" '` Enter
  Type@0 "clear" Enter
  Sleep 1

  # 擬似的にclaudeを再現
  Type "cat docs/pseudo-ai-agent-output.txt" Enter
  # Type "tmux list-keys | grep C-e" Enter
Show

Ctrl+B Type@0 q

Sleep 1s
Hide
  Type "i"
  Escape
  Type@0 ":lua require('nvim-autopairs').disable()" Enter
  # Type@0 ":RenderMarkdown disable" Enter
  Sleep 50ms
Show

Ctrl+B Type@0 q
Ctrl+B Type@0 "["
Sleep 1s

Type kkkkkkkkk
Sleep 1s
Type Vj
Sleep 1s
Ctrl+E
Sleep 1s

Type jjjj
Sleep 1s
Type Vj
Sleep 1s
Ctrl+E
Sleep 1s

Ctrl+B Type@0 q

Sleep 500ms
Space Type@0 X
Sleep 5s
