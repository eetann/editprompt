# Custom Backends

editprompt ships with backends for tmux, WezTerm, Herdr, niwaterm and Rex. Any other terminal or multiplexer that can be driven from the command line can be added in your configuration file, without changing editprompt itself.

## Configuration File

editprompt reads its configuration from `~/.config/editprompt/config.jsonc`:

```jsonc
// ~/.config/editprompt/config.jsonc
{
  "backends": {
    "mytty": {
      // Pick this backend automatically when the variable is set
      "detect": { "env": "MYTTY_PANE_ID" },
      // The pane editprompt is running in
      "currentPane": { "env": "MYTTY_PANE_ID" },
      // Exits 0 when the pane exists
      "paneExists": ["mytty", "pane", "exists", "{pane}"],
      "focus": ["mytty", "pane", "focus", "{pane}"],
      // Text arrives on stdin, so it never needs escaping
      "sendText": { "argv": ["mytty", "send-text", "--pane", "{pane}"], "stdin": true },
      "sendKey": ["mytty", "send-key", "--pane", "{pane}", "{key}"],
    },
  },
}
```

Then use it like a built-in backend:

```bash
editprompt open --mux mytty --target-pane "$MYTTY_PANE_ID"
```

The configuration directory is `$XDG_CONFIG_HOME/editprompt` (`~/.config/editprompt` by default), or `$EDITPROMPT_CONFIG_DIR` when that is set. The file is loaded with [c12](https://github.com/unjs/c12), so `config.json`, `config.json5`, `config.yaml`, `config.toml`, `config.js`, `config.ts` and the other formats c12 supports work as well, as does an `.editpromptrc` file.

editprompt never reads a configuration file from the current working directory, so a repository you open cannot change how editprompt talks to your terminal.

## Commands

Every operation is a command written as an argv array. It is run directly, without a shell, so arguments are passed exactly as written. `{placeholder}`s inside an argument are replaced with the values of the call.

| Option        | Required | Placeholders                | What the command does                                                 |
| ------------- | -------- | --------------------------- | --------------------------------------------------------------------- |
| `currentPane` | yes      | –                           | Prints the ID of the pane editprompt runs in. Or `{ "env": "VAR" }`   |
| `paneExists`  | yes      | `{pane}`                    | Exits 0 when the pane exists, anything else when it does not          |
| `focus`       | yes      | `{pane}`                    | Focuses the pane                                                      |
| `sendText`    | yes      | `{pane}`, `{text}`          | Types text into the pane without pressing Enter                       |
| `sendKey`     | yes      | `{pane}`, `{key}`           | Sends one key, such as Enter or Tab                                   |
| `splitPane`   | no       | `{pane}`, `{rows}`, `{cwd}` | Opens a pane next to `{pane}` and prints its ID                       |
| `runInPane`   | no       | `{pane}`, `{command}`       | Runs `{command}`, the shell-quoted editprompt command line, in a pane |
| `closePane`   | no       | `{pane}`                    | Closes the pane                                                       |

A command can also be written as `{ "argv": [...], "stdin": true }` to receive its input on stdin. For `sendText` the input is the text itself; prefer it over `{text}` whenever the CLI can read stdin, since a command-line argument is limited in size.

`splitPane`, `runInPane` and `closePane` are optional and go together. With them, `editprompt toggle` works with the backend: it opens the editor pane itself and runs `editprompt open` in it.

```jsonc
{
  "backends": {
    "mytty": {
      // ... the required commands ...
      "splitPane": [
        "mytty",
        "split",
        "--below",
        "--of",
        "{pane}",
        "--rows",
        "{rows}",
        "--cwd",
        "{cwd}",
      ],
      "runInPane": ["mytty", "run", "--pane", "{pane}", "exec {command}"],
      "closePane": ["mytty", "pane", "close", "{pane}"],
    },
  },
}
```

## Other Options

| Option           | Default      | Description                                                                    |
| ---------------- | ------------ | ------------------------------------------------------------------------------ |
| `detect`         | –            | `{ "env": "VAR" }`: select this backend when `VAR` is set and not empty        |
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
