# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `editprompt`, a CLI tool that lets you write prompts for Claude Code using your favorite text editor. It detects running Claude processes and sends content to them via tmux integration or clipboard fallback.

## Development Commands

### Build and Development
- `bun run build` - Build the project using tsdown
- `bun run dev` - Build in watch mode for development
- `bun test` - Run tests using bun
- `bun test --watch` - Run tests in watch mode

### Code Quality
- Format and lint using Biome (configured in `biome.jsonc`)
- The project uses tab indentation and double quotes
- No explicit lint/format commands in package.json - use your editor's Biome integration

## Architecture

### Core Flow
1. **CLI Entry** (`src/index.ts`) - Uses gunshi for CLI parsing, orchestrates the main workflow
2. **Editor Module** (`src/modules/editor.ts`) - Handles editor launching and content extraction
3. **Process Detection** (`src/modules/process.ts`) - Finds Claude processes, with tmux integration priority
4. **Process Selection** (`src/modules/selector.ts`) - Interactive selection when multiple processes found
5. **Content Delivery** - Sends to tmux panes via `tmux send-keys` or falls back to clipboard

### Key Design Patterns
- **Tmux-First Strategy**: Prioritizes tmux panes over regular processes for seamless integration
- **Graceful Fallbacks**: Editor → Process Detection → Tmux → Clipboard (with user feedback)
- **Process Matching**: Links system processes to tmux panes by parent PID for accurate targeting

### Module Responsibilities
- `editor.ts`: Editor selection ($EDITOR priority), temp file management, content extraction
- `process.ts`: Process discovery, tmux pane enumeration, content delivery mechanisms
- `selector.ts`: User interaction for process selection when multiple options exist
- `tempFile.ts`: Secure temporary file creation and cleanup
- `constants.ts`: Configuration values (process name, file patterns, default editor)

### Dependencies
- `gunshi` - CLI framework
- `inquirer` - Interactive process selection
- `find-process` - System process discovery
- `clipboardy` - Clipboard operations
- Native Node.js modules for tmux integration and file operations

## Testing

Tests are located in `test/` directory with structure mirroring `src/`. Uses bun test runner with integration tests covering the full workflow.