# Repository Guidelines

## Project Structure & Module Organization
- `src/` TypeScript sources: `index.ts` (CLI), `modules/` (editor/process/selector), `utils/`, `config/`.
- `test/` Bun tests mirroring `src/` (unit + `integration.test.ts`).
- `dist/` build output; `scripts/` helper shell scripts; `templates/` docs/templates.

## Build, Test, and Development Commands
- `bun install` Install dependencies.
- `bun run dev` Watch build via `tsdown`.
- `bun run build` Compile to `dist/`.
- `bun test` Run tests (`bun test --watch` to watch).
- `bun run lint` Lint with Biome (`biome check`).
- `bun run formant` Format with Biome (writes changes).
- `bun run typecheck` Type-check (no emit).

## Coding Style & Naming Conventions
- Language: TypeScript (ESNext, ESM). Strict mode enabled.
- Formatting: tabs for indentation, double quotes; enforced by Biome (`biome.jsonc`).
- Files: descriptive lowercase names under `src/modules`, `src/utils`, `src/config`.
- Exports: functions/variables in `camelCase`; types/interfaces in `PascalCase`.
- Prefer small, focused modules and pure functions where possible.

## Testing Guidelines
- Framework: `bun:test`.
- Location: `test/**/*`; name files `*.test.ts` and mirror `src/` structure.
- Add unit tests for new logic and update/extend integration tests when flows change.
- Keep tests deterministic; mock OS/tmux/clipboard interactions (skip platform-specific tests when needed).

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat:`, `fix:`, `docs:`, `chore:`) as used in history.
- PRs: clear description, linked issues, rationale, and testing notes. Include CLI output or short recordings for UX-affecting changes. Update README/usage examples and tests as needed.

## Security & Configuration Tips
- Do not commit secrets. Tests must not require real tmux or clipboard; mock instead.
- The CLI sets `EDITPROMPT=1` for editor sessions—preserve this behavior.
- Keep fallbacks intact: tmux → clipboard. Avoid regressions here.

## Agent-Specific Instructions
- Make minimal, surgical changes; avoid repo-wide reformatting.
- Follow Biome and existing patterns; do not add license headers.
- If adding commands or flags, update `README.md` and add tests.
