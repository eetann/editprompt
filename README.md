# editprompt

A CLI tool that lets you write prompts for CLI tools using your favorite text editor. Originally designed for [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview), but works with any CLI process.

https://github.com/user-attachments/assets/01bcda7c-7771-4b33-bf5c-629812d45cc4

## Features

- 🖊️ **Editor Integration**: Use your preferred text editor to write prompts  
- 🔍 **Process Detection**: Automatically detects running CLI processes (configurable)
- 🖥️ **Tmux Support**: Send prompts directly to tmux sessions
- 📋 **Clipboard Fallback**: Automatically copies to clipboard if sending fails
- ⚡ **Smart Fallbacks**: Multiple fallback strategies ensure your prompt gets delivered

## Installation

```bash
# Install globally via npm
npm install -g editprompt

# Or use with npx
npx editprompt
```

## Usage

### Basic Usage

```bash
# Use with your default editor (from $EDITOR)
editprompt

# Specify a different editor
editprompt --editor nvim
editprompt -e nvim

# Target a different process (default: claude)
editprompt --process gemini
editprompt -p gemini

# Send content to a specific tmux pane
editprompt --target-pane %45
editprompt -t %45

# Show help
editprompt --help

# Show version
editprompt --version
```

### Tmux Integration

editprompt offers two modes for tmux integration:

#### Recommended: Direct Pane Targeting
Use `--target-pane #{pane_id}` to automatically send content back to the pane where you triggered the command. This is useful when using Claude Code, etc. in multiple panes.

**Split window version:**
```tmux
bind -n M-q run-shell 'tmux split-window -v -l 20 \
  -c "#{pane_current_path}" \
  "editprompt --editor nvim --target-pane #{pane_id}"'
```

**Popup version:**
```tmux
bind -n M-q run-shell 'tmux display-popup -E \
  -d "#{pane_current_path}" \
  -w 80% -h 65% \
  "editprompt --editor nvim --target-pane #{pane_id}"'
```

#### Alternative: Process Auto-detection
Let editprompt automatically detect and select target processes:

**Split window version:**
```tmux
bind -n M-q split-window -v -l 10 \
  -c '#{pane_current_path}' \
  'editprompt --editor nvim'
```

**Popup version:**
```tmux
bind -n M-q display-popup -E \
  -d '#{pane_current_path}' \
  'editprompt --editor nvim'
```

### How it Works

1. **Opens your editor** with a temporary markdown file
2. **Write your prompt** and save/exit the editor  
3. **Sends the prompt** using one of two modes:
   - 🎯 **Direct pane mode** (`--target-pane`): Sends directly to specified tmux pane
   - 🔍 **Process detection mode**: Finds target processes and sends via tmux or clipboard
4. **Fallback strategy** ensures delivery:
   - Tmux integration (preferred)
   - Clipboard copy (fallback)


## Configuration

### Editor Selection

editprompt respects the following editor priority:

1. `--editor/-e` command line option
2. `$EDITOR` environment variable  
3. Default: `nvim`

### Environment Variables

- `EDITOR`: Your preferred text editor

---

## Development

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

### Project Structure

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

## Technical Details

### Tmux Integration

editprompt supports two tmux integration modes:

- **Direct pane targeting** (`--target-pane`): Bypasses process detection and sends content directly to specified pane ID
- **Process-based targeting**: Detects target processes and links them to tmux panes for delivery

### Fallback Strategy

editprompt implements a robust fallback strategy:

1. **Tmux Integration**: Direct input to tmux panes (when available)
2. **Clipboard**: Copy content to clipboard with user notification
