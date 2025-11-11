Output write-close-send.gif
Set Shell zsh
Set FontSize 14
Set Width 800
Set Height 500
Set Framerate 60
Set Padding 10
Set WindowBar Colorful
Set BorderRadius 10
Set FontFamily "HackGen Console NF"
Set Theme "Builtin Solarized Dark"

Hide
  Type@0 "tmux -L test kill-server" Enter
  Type@0 "tmux -f /dev/null -L test new-session -- zsh" Enter
  Type@0 "tmux set status" Enter
  Type@0 'tmux setw pane-border-style "fg=0"' Enter
  Type@0 'tmux setw pane-active-border-style "fg=0"' Enter
  Type@0 'tmux set -g @editprompt-cmd "node ~/ghq/github.com/eetann/editprompt/dist/index.js"' Enter
  Type@0 `tmux bind -N 'editprompt' q run-shell '#{@editprompt-cmd} --resume --target-pane #{pane_id} || tmux split-window -v -l 10 -c "#{pane_current_path}" "#{@editprompt-cmd} --editor nvim --target-pane #{pane_id} --always-copy"'` Enter
  Type@0 "clear" Enter
  Sleep 1
  Type "claude"
Show

Sleep 1s
Enter
Wait+Screen@5s /session/ # ステータスラインを待つ

# キーバインドが設定されているか見る。だいたいEnter忘れ
# Ctrl+B Type@0 "?"
# Ctrl+D
# Sleep 1s
# Ctrl+D
# Sleep 1s
# Ctrl+D

Ctrl+B Type@0 q
Sleep 1s
Hide
  Type "i"
  Escape
  Type@0 ":lua require('nvim-autopairs').disable()" Enter
  Sleep 50ms
Show

Type "i"
Type "foo bar" Enter
Type "```javascript" Enter
Type "console.log('buz')" Enter
Type "```"
Sleep 1s
Escape

Type@300ms ":wq" Enter
Sleep 3s

Hide
Ctrl+C
Ctrl+C
