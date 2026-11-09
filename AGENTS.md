# AGENTS.md

Guidance for coding agents working in this repository.

## Project Overview

`editprompt` is a CLI that lets you write prompts for CLI tools (Claude Code, Codex CLI, ...) in your own editor and sends them to the target pane. Delivery goes through a pluggable backend (tmux, WezTerm, Herdr, niwaterm, Rex, or a backend declared in the user's configuration file), falling back to the clipboard.

User-facing behavior is documented in `README.md`. Read it before changing a subcommand.

## Commands

- `bun run build` - Build with tsdown
- `bun run test` - Run tests (bun test)
- `bun run lint` / `bun run lint:fix` - oxlint and oxfmt
- `bun run typecheck` - Type check with tsgo

CI runs lint, typecheck, test and build. Run them before finishing a change.

## Conventions

- Write comments, docs and commit messages in English
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, ...)
- Formatting is whatever oxfmt produces; do not format by hand

## Architecture

```
src/index.ts      CLI entry (gunshi); registers configured backends, then dispatches subcommands
src/modes/        One file per subcommand (open, register, resume, toggle, input, press, collect, dump, stash)
src/core/         Backend-agnostic logic: editor-target links, quote buffer, resume focus switching, chunked delivery
src/backends/     MuxBackend interface, state stores, built-in backend definitions, registry, command-template backends
src/modules/      Low-level calls: one file per multiplexer CLI/API, plus editor, logger, conf
src/config/       Constants and the user configuration loader
src/utils/        Pure helpers (argument parsing, content/quote processing, chunking, ...)
```

Rules that the code relies on:

- **Modes never branch on a multiplexer name.** Everything goes through `MuxBackend` (`src/backends/types.ts`), resolved by `src/backends/registry.ts` from `--mux`, `EDITPROMPT_MUX`, detection, then the tmux fallback. A difference between multiplexers belongs in a backend field (`quietResumeErrors`, `keepNewerEditorLink`, ...), not in a mode.
- **Built-in backends keep their existing behavior.** Storage keys (`@editprompt_*` pane variables, Conf keys such as `wezterm.targetPane.pane_<id>`), log messages, exit codes and error reporting are relied on by existing users and their configurations. A refactor must not change them unless that is the point of the change.
- **`toggle` is a capability.** It works only with backends that implement `splitPane`, `runInPane` and `closePane` together (`canSplitPane`).
- **The configuration file is never read from the cwd.** `src/config/userConfig.ts` loads it with c12 from the user's config directory only, so a repository cannot change how editprompt drives the terminal. c12 is loaded only when a configured backend may be selected, to keep startup fast.

### Adding a built-in backend

1. Write the CLI/API calls in `src/modules/<name>.ts`
2. Define the backend in `src/backends/<name>.ts` with `defineBackend`, choosing `paneVariableStore` when the multiplexer has per-pane variables and `confStore` otherwise
3. Add it to `BUILTIN_BACKENDS` in `src/backends/registry.ts` (order is detection order)
4. Document it in `README.md`, and in `docs/modes.md` if it has constraints that the code does not make obvious

## Testing

Tests live in `test/`, mirroring `src/`. Logic in `src/core/` and `src/modes/` is tested against `test/helpers/fakeBackend.ts` instead of a real multiplexer.

## Docs

- `docs/backends.md` - User reference for backends declared in the configuration file
- `docs/modes.md` - Per-multiplexer constraints and the reasons behind non-obvious implementation choices
- `docs/developer.md` - Setup and trying a local build
- `docs/migration-guide-v1.md` - Migration from v0.8.1 or earlier
- `docs/*.tape` - VHS scripts for the demo GIFs in the README

Keep docs to what the code does not already say. Do not restate the implementation step by step.
