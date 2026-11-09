# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `editprompt`, a CLI tool that lets you write prompts for CLI tools using your favorite text editor. Originally designed for Claude Code, but now works with any CLI process. It sends content to target panes through a pluggable backend (tmux, WezTerm, Herdr, niwaterm, Rex, or a backend declared in the user's configuration file), or via the clipboard.

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
- **Use English for all comments and commit messages**

## Architecture

### Core Flow

1. **CLI Entry** (`src/index.ts`) - Uses gunshi for CLI parsing, orchestrates the main workflow
2. **Mode Selection** (`src/modes/`) - Routes to appropriate mode handler (openEditor, resume, sendOnly)
3. **Editor Module** (`src/modules/editor.ts`) - Handles editor launching and content extraction
4. **Process Detection** (`src/modules/process.ts`) - Finds target processes (configurable)
5. **Backend Resolution** (`src/backends/registry.ts`) - Resolves `--mux` / `EDITPROMPT_MUX` / auto-detection to a `MuxBackend`
6. **Core Logic** (`src/core/`) - Editor-target links, quote buffer, resume focus switching and chunked delivery, written once against `MuxBackend`
7. **Content Delivery** - Sends to target panes through the backend or falls back to clipboard

### Modes

- **openEditor**: Launches editor, waits for content, sends to target pane when editor closes
- **resume**: Reuses existing editor panes with bidirectional focus switching
- **sendOnly**: Sends content directly to target pane without opening editor (designed for in-editor execution)
- **quote**: Collects text selections and stores them as quoted text (with `> ` prefix) for later retrieval
- **capture**: Retrieves accumulated quoted text from quote mode and outputs to stdout, then clears storage

For detailed mode implementation including constraints and solutions for different multiplexers, see [`docs/modes.md`](docs/modes.md).

### Key Design Patterns

- **Backend Interface**: Modes never branch on a multiplexer name; every backend implements `MuxBackend` (`src/backends/types.ts`) and is looked up through the registry
- **Pluggable Backends**: Users can declare command-template backends in `~/.config/editprompt/config.jsonc` (loaded with c12; see `docs/backends.md`)
- **Capabilities**: Optional backend methods (`splitPane`, `runInPane`, `closePane`) gate features such as `toggle`
- **Graceful Fallbacks**: Editor → Process Detection → Multiplexer → Clipboard (with user feedback)
- **Process Matching**: Links system processes to multiplexer panes for accurate targeting
- **Mode Separation**: Each mode has isolated logic for different use cases

### Directory Structure

- `modes/`: Mode implementations (openEditor, resume, sendOnly, common)
- `backends/`: `MuxBackend` interface, pane state stores, built-in backend definitions, command-template backends, registry
- `core/`: Backend-agnostic logic (link, quote, resume, delivery)
- `modules/`: Low-level modules (editor, logger, conf) and per-multiplexer CLI/API calls (tmux, wezterm, herdr, niwaterm, rex)
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
- `backends/types.ts`: `MuxBackend` and `PaneStateStore` interfaces
- `backends/stores.ts`: `paneVariableStore` (tmux, niwaterm) and `confStore` (WezTerm, Herdr, Rex, configured backends), keeping the existing storage keys
- `backends/command.ts`: Builds and validates backends declared in the configuration file
- `config/userConfig.ts`: Loads the configuration with c12 from the user's config directory (never the cwd)
- `modules/tmux.ts`, `wezterm.ts`, `herdr.ts`, `niwaterm.ts`, `rex.ts`: Transport primitives for each multiplexer
- `utils/tempFile.ts`: Secure temporary file creation and cleanup
- `config/constants.ts`: Configuration values (default process name, file patterns, default editor)

### Dependencies

- `gunshi` - CLI framework
- `clipboardy` - Clipboard operations
- `conf` - Persistent storage (used for WezTerm, Herdr, Rex and configured backends' state, and stash)
- `c12` - Configuration file loader
- Native Node.js modules for multiplexer integration and file operations

## Testing

Tests are located in `test/` directory with structure mirroring `src/`. Uses bun test runner with integration tests covering the full workflow.
