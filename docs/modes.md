# Multiplexer Constraints and Design Notes

This document records the constraints of each multiplexer and the reasons behind implementation choices that the code alone does not explain. For how a subcommand behaves, read `README.md` and `src/modes/`; for the backend interface, read `src/backends/types.ts`.

## How the editor finds its targets

`open` launches the editor with `EDITPROMPT=1`, `EDITPROMPT_MUX` and `EDITPROMPT_ALWAYS_COPY` set, and records the editor-target link in the backend's state store. Commands run from inside the editor (`input`, `press`, `dump`, `stash`) inherit those variables from the editor process, so they need no `--mux` or `--target-pane`: they take the current pane as the editor pane and read its targets from the store.

`register` creates the same link for an editor that editprompt did not launch.

## Where state lives

| Backend             | Store                           | Why                                                                |
| ------------------- | ------------------------------- | ------------------------------------------------------------------ |
| tmux                | Pane options (`@editprompt_*`)  | State dies with the pane, and `run-shell` can read `#{pane_id}`    |
| niwaterm            | Tab variables (`editprompt_*`)  | Same as tmux                                                       |
| WezTerm             | Conf (`wezterm.*`)              | No external pane variables (see below)                             |
| Herdr               | Conf (`herdr.session_<hash>.*`) | Pane metadata is not a key/value store editprompt can own          |
| Rex                 | Conf (`rex.*`)                  | No per-block key/value store; `set_block_label` is a visible label |
| Configured backends | Conf (`state.<name>.*`)         | Works without any terminal support                                 |

Stash always uses Conf, whatever the backend.

A link can outlive the pane it points to: Conf entries are never cleaned up by the terminal, and a target pane keeps its pane variable after the editor pane closes. `resume` therefore checks that a pane exists before focusing it. From a target pane it forgets the link when the editor pane is gone; from an editor pane it focuses the first target pane that still exists.

## tmux

- `run-shell` starts a new shell that does not inherit `$EDITOR` from the user's shell, so key bindings pass `--editor` explicitly. It can still expand `#{pane_id}`, which is why tmux needs no extra state to find the target pane.
- In copy mode, `send-keys` drives copy mode instead of typing, so `beforeSendText` leaves copy mode first.
- `collect` reads the selection from stdin, because tmux copy mode hands it to `send-keys -X pipe`.

## WezTerm

- WezTerm is never auto-detected; it is selected with `--mux wezterm` or `EDITPROMPT_MUX`.
- `run_child_process` and `SplitPane` inherit neither the environment nor PATH, so bindings run editprompt through a login shell (`/bin/zsh -lc "editprompt ..."`).
- WezTerm has [user variables via OSC 1337](https://wezfurlong.org/wezterm/shell-integration.html#user-vars), but only the program running in a pane can set them. They cannot be set from outside on a pane that already runs Claude Code or nvim, so state lives in Conf instead.
- Key notation is the raw byte sequence (`\r`, `\x1b[A`), not a key name.

## Herdr

- Herdr custom commands run detached, outside any pane. editprompt uses `HERDR_ACTIVE_PANE_ID` there and `HERDR_PANE_ID` inside a pane. Because of this, `resume --target-pane` may name the editor pane itself (`resumeAcceptsEditorPane`), and `toggle` switches back to its first available target pane.
- State is namespaced by a hash of `HERDR_SOCKET_PATH`, so named sessions do not see each other's pane IDs.
- An editor pane closing must not clear a link that a newer editor pane has since written (`keepNewerEditorLink`).
- Split ratios are clamped to 10–90%, so `--pane-rows` is only approximated outside that range. The split's shell is replaced with `editprompt open`, so the pane closes when the editor exits.

## Rex

- The CLI is taken from `REX_BIN_DIR` before PATH. A terminal started from `init.lua` runs the login shell's environment but not its interactive configuration, which may rebuild PATH without the directory Rex added.
- No session scope is passed: block IDs (`block:<uuid>`) are unique across the server, and `register --target-pane` may name a block in another session.
- Every call passes `--autostart=false`. These commands only act on existing blocks, so a missing server means the panes are gone, not that one should be started.
- Only `send` gets stdin; every other call runs with stdin closed, so a wrong argv fails instead of waiting for input.
- The editor split is created by `init.lua`, not by editprompt (`toggle` is not supported), because Rex's Lua configuration can both run commands and build layouts. The split is sized by a fraction derived from the target's row count, which only holds with "Autobalance Splits" turned off.

## niwaterm

- Text is sent with `niwa tab send-keys -t <tab> -- <text>`; the `--` keeps text that starts with `-` from being parsed as an option.
