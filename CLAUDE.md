# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `editprompt`, a CLI tool that lets you write prompts for CLI tools using your favorite text editor. Originally designed for Claude Code, but now works with any CLI process. It detects running target processes and sends content to them via tmux integration or clipboard fallback.

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
-  **Use English for all comments and commit messages** 

## Architecture

### Core Flow
1. **CLI Entry** (`src/index.ts`) - Uses gunshi for CLI parsing, orchestrates the main workflow
2. **Mode Selection** (`src/modes/`) - Routes to appropriate mode handler (openEditor, resume, sendOnly)
3. **Editor Module** (`src/modules/editor.ts`) - Handles editor launching and content extraction
4. **Process Detection** (`src/modules/process.ts`) - Finds target processes (configurable)
5. **Multiplexer Integration** (`src/modules/tmux.ts`, `src/modules/wezterm.ts`) - Handles multiplexer-specific operations
6. **Content Delivery** - Sends to multiplexer panes via `send-keys` or falls back to clipboard

### Modes
- **openEditor**: Launches editor, waits for content, sends to target pane when editor closes
- **resume**: Reuses existing editor panes with bidirectional focus switching
- **sendOnly**: Sends content directly to target pane without opening editor (designed for in-editor execution)
- **quote**: Collects text selections and stores them as quoted text (with `> ` prefix) for later retrieval
- **capture**: Retrieves accumulated quoted text from quote mode and outputs to stdout, then clears storage

For detailed mode implementation including constraints and solutions for different multiplexers, see [`docs/modes.md`](docs/modes.md).

### Key Design Patterns
- **Multiplexer-First Strategy**: Supports both tmux and WezTerm with multiplexer-specific implementations
- **Graceful Fallbacks**: Editor → Process Detection → Multiplexer → Clipboard (with user feedback)
- **Process Matching**: Links system processes to multiplexer panes for accurate targeting
- **Mode Separation**: Each mode has isolated logic for different use cases

### Directory Structure
- `modes/`: Mode implementations (openEditor, resume, sendOnly, common)
- `modules/`: Core functionality modules (editor, process, tmux, wezterm)
- `utils/`: Utility functions (argumentParser, contentProcessor, envParser, sendConfig, tempFile)
- `config/`: Configuration values (constants)
- `types/`: TypeScript type definitions
- `docs/`: Documentation files

### Module Responsibilities
- `modes/openEditor.ts`: Standard editor launch and content delivery workflow
- `modes/resume.ts`: Editor pane reuse with bidirectional focus switching
- `modes/sendOnly.ts`: Direct content sending from within editor
- `modules/editor.ts`: Editor selection ($EDITOR priority), temp file management, content extraction
- `modules/process.ts`: Process discovery and content delivery mechanisms
- `modules/tmux.ts`: tmux-specific operations (pane variables, focus switching)
- `modules/wezterm.ts`: WezTerm-specific operations (Conf-based state management, focus switching)
- `utils/tempFile.ts`: Secure temporary file creation and cleanup
- `config/constants.ts`: Configuration values (default process name, file patterns, default editor)

### Dependencies
- `gunshi` - CLI framework
- `clipboardy` - Clipboard operations
- `conf` - Persistent configuration storage (used for WezTerm state management)
- Native Node.js modules for multiplexer integration and file operations

## Testing

Tests are located in `test/` directory with structure mirroring `src/`. Uses bun test runner with integration tests covering the full workflow.
