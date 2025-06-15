# ccsender

WIP!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

A CLI tool that lets you write prompts for Claude Code using your favorite text editor.

## Features

- 🖊️ **Editor Integration**: Use your preferred text editor to write prompts  
- 🔍 **Process Detection**: Automatically detects running Claude Code processes
- 🖥️ **Tmux Support**: Send prompts directly to tmux sessions running Claude
- 📋 **Clipboard Fallback**: Automatically copies to clipboard if sending fails
- ⚡ **Smart Fallbacks**: Multiple fallback strategies ensure your prompt gets delivered

## Installation

WIP!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

```bash
# Install globally via npm
npm install -g ccsender

# Or use with npx
npx ccsender
```

## Usage

### Basic Usage

```bash
# Use with your default editor (from $EDITOR)
ccsender

# Specify a different editor
ccsender --editor vim
ccsender -e code

# Show help
ccsender --help

# Show version
ccsender --version
```

### How it Works

1. **Opens your editor** with a temporary markdown file
2. **Write your prompt** and save/exit the editor  
3. **Detects Claude processes** running on your system
4. **Sends the prompt** using the best available method:
   - 🎯 **Tmux sessions**: Direct input via `tmux send-keys`
   - 🆕 **New Claude instance**: Pipes content to `claude` command
   - 📋 **Clipboard**: Copies content as final fallback

### Process Selection

When multiple Claude processes are detected, you'll see an interactive selection menu:

```
? Select a Claude process:
  1. PID: 12345 | Tmux: main:0.1 | Directory: /home/user/project1
  2. PID: 67890 | Directory: /home/user/project2
```

The display shows:
- **PID**: Process ID
- **Tmux**: Session, window, and pane (if running in tmux)
- **Directory**: Working directory of the process

## Configuration

### Editor Selection

ccsender respects the following editor priority:

1. `--editor/-e` command line option
2. `$EDITOR` environment variable  
3. Default: `vi`

### Environment Variables

- `EDITOR`: Your preferred text editor

## Requirements

- Node.js 18+ or Bun
- Claude Code CLI (`claude` command)
- Optional: tmux (for direct session integration)

## Development

```bash
# Clone the repository
git clone https://github.com/eetann/ccsender.git
cd ccsender

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

When Claude is running in a tmux session, ccsender uses `tmux send-keys` to send input directly to the appropriate pane. This provides seamless integration without disrupting your existing Claude session.

### Fallback Strategy

ccsender implements a robust three-tier fallback strategy:

1. **Tmux Integration**: Direct input to tmux panes (when available)
<!-- 2. **New Process**: Launch new Claude instance with piped input -->
2. **Clipboard**: Copy content to clipboard with error notification


## Related Projects

- [Claude Code](https://claude.ai/code) - The official Claude CLI
- [Gunshi](https://gunshi.dev/) - CLI framework used for argument parsing
