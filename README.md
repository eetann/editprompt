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

# Show help
editprompt --help

# Show version
editprompt --version
```

It is useful to configure tmux as follows.

```tmux
bind -n M-q split-window -v -l 10 \
  -c '#{pane_current_path}' \
  'editprompt --editor nvim'
```

If you prefer popup, you can configure it as follows.
```tmux
bind -n M-q display-popup -E \
  -d '#{pane_current_path}' \
  'editprompt --editor nvim'
```

### How it Works

1. **Opens your editor** with a temporary markdown file
2. **Write your prompt** and save/exit the editor  
3. **Detects target processes** running on your system (default: claude)
4. **Sends the prompt** using the best available method:
   - 🎯 **Tmux sessions**: Direct input via `tmux send-keys`
   - 📋 **Clipboard**: Copies content as final fallback


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

When the target process is running in a tmux session, editprompt uses `tmux send-keys` to send input directly to the appropriate pane. This provides seamless integration without disrupting your existing session.

### Fallback Strategy

editprompt implements fallback strategy:

1. **Tmux Integration**: Direct input to tmux panes (when available)
<!-- 2. **New Process**: Launch new Claude instance with piped input -->
2. **Clipboard**: Copy content to clipboard with error notification
