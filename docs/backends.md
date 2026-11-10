# Custom Backends

editprompt ships with backends for tmux, WezTerm, Herdr, niwaterm and Rex. Any other terminal or multiplexer that can be driven from the command line can be added in your configuration file, without changing editprompt itself.

## Configuration File

editprompt reads its configuration from `~/.config/editprompt/config.toml`:

```toml
# ~/.config/editprompt/config.toml
[backends.mytty]
# Pick this backend automatically when the variable is set
detect = { env = "MYTTY_PANE_ID" }
# The pane editprompt is running in
currentPane = { env = "MYTTY_PANE_ID" }
# Exits 0 when the pane exists
paneExists = 'mytty pane exists "$EDITPROMPT_PANE"'
focus = 'mytty pane focus "$EDITPROMPT_PANE"'
# The text arrives on stdin, so it never needs escaping
sendText = 'mytty send-text --pane "$EDITPROMPT_PANE"'
sendKey = 'mytty send-key --pane "$EDITPROMPT_PANE" "$EDITPROMPT_KEY"'
```

Then use it like a built-in backend:

```bash
editprompt open --mux mytty --target-pane "$MYTTY_PANE_ID"
```

The configuration directory is `$XDG_CONFIG_HOME/editprompt` (`~/.config/editprompt` by default), or `$EDITPROMPT_CONFIG_DIR` when that is set. The file is loaded with [c12](https://github.com/unjs/c12), so `config.json`, `config.jsonc`, `config.yaml`, `config.js`, `config.ts` and the other formats c12 supports work as well, as does an `.editpromptrc` file. The examples here use TOML because its multi-line strings make longer scripts easy to write.

editprompt never reads a configuration file from the current working directory, so a repository you open cannot change how editprompt talks to your terminal.

## Commands

Every operation is a shell script, run with `/bin/sh -c`. The values of the call are passed as environment variables, so write `"$EDITPROMPT_PANE"` with double quotes and the shell passes the value as one argument, whatever it contains. Using a variable that a command does not receive is reported as a configuration error.

| Option        | Required | Variables                                              | What the script does                                                        |
| ------------- | -------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `currentPane` | yes      | –                                                      | Prints the ID of the pane editprompt runs in. Or `{ env = "VAR" }`          |
| `paneExists`  | yes      | `EDITPROMPT_PANE`                                      | Exits 0 when the pane exists, anything else when it does not                |
| `focus`       | yes      | `EDITPROMPT_PANE`                                      | Focuses the pane                                                            |
| `sendText`    | yes      | `EDITPROMPT_PANE`                                      | Types the text it reads from stdin into the pane, without pressing Enter    |
| `sendKey`     | yes      | `EDITPROMPT_PANE`, `EDITPROMPT_KEY`                    | Sends one key, such as Enter or Tab                                         |
| `splitPane`   | no       | `EDITPROMPT_PANE`, `EDITPROMPT_ROWS`, `EDITPROMPT_CWD` | Opens a pane next to the pane and prints its ID                             |
| `runInPane`   | no       | `EDITPROMPT_PANE`, `EDITPROMPT_COMMAND`                | Runs `$EDITPROMPT_COMMAND`, the shell-quoted editprompt command line, in it |
| `closePane`   | no       | `EDITPROMPT_PANE`                                      | Closes the pane                                                             |

If the terminal's CLI takes the text as an argument rather than on stdin, read stdin in the script: `mytty send-text --pane "$EDITPROMPT_PANE" "$(cat)"`. Note that `$(...)` drops trailing newlines.

`splitPane`, `runInPane` and `closePane` are optional and go together. With them, `editprompt toggle` works with the backend: it opens the editor pane itself and runs `editprompt open` in it.

```toml
[backends.mytty]
# ... the required commands ...
splitPane = '''
mytty split --below \
  --of "$EDITPROMPT_PANE" \
  --rows "$EDITPROMPT_ROWS" \
  --cwd "$EDITPROMPT_CWD"
'''
runInPane = 'mytty run --pane "$EDITPROMPT_PANE" "exec $EDITPROMPT_COMMAND"'
closePane = 'mytty pane close "$EDITPROMPT_PANE"'
```

## Other Options

| Option           | Default      | Description                                                                    |
| ---------------- | ------------ | ------------------------------------------------------------------------------ |
| `detect`         | –            | `{ env = "VAR" }`: select this backend when `VAR` is set and not empty         |
| `maxChunkBytes`  | `8192`       | Long text is split into chunks of at most this many bytes, one `sendText` each |
| `submitKey`      | `"Enter"`    | Key sent by `editprompt input --auto-send` when `--send-key` is not given      |
| `quoteSeparator` | `"\n\n"`     | Separator placed between quotes collected with `editprompt collect`            |
| `collectInput`   | `"argument"` | Whether `collect` reads the selection from its argument or from `"stdin"`      |

## Selecting the Backend

editprompt picks the backend in this order:

1. `--mux <name>`
2. `EDITPROMPT_MUX`
3. Detection: Herdr, niwaterm and Rex first, then backends with `detect`, in the order they appear in the file
4. tmux

Configured backends cannot replace a built-in one: a backend named `tmux` is reported as an error. A backend with a mistake is skipped with a message on stderr, and the built-in backends keep working.

## State

editprompt remembers which editor pane belongs to which target pane, the quotes collected with `collect`, and stashed prompts. For a configured backend this lives in editprompt's own storage under `state.<name>`, so the terminal does not need to support pane variables.
