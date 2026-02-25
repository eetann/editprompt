# Migration Guide: v0.8.1 → v1.0.0

This guide helps you migrate from editprompt v0.8.1 (and earlier) to v1.0.0, which introduces a breaking change to the CLI interface.

## What Changed?

**v1.0.0 migrates from option-based modes to explicit subcommands** for better CLI consistency and usability. This is a **breaking change** - old command syntax will no longer work.

### Why This Change?

The old syntax mixed different patterns (no options, `--resume`, `-- "content"`), making the CLI confusing and inconsistent. The new subcommand-based approach provides:

- **Consistent interface**: All modes use the same `editprompt <subcommand>` pattern
- **Better discoverability**: `editprompt --help` clearly shows available subcommands
- **Easier maintenance**: Each subcommand has its own isolated definition and help
- **Future extensibility**: Adding new modes is simpler and clearer

## Command Migration Table

| Old Command (v0.8.1)               | New Command (v1.0.0)                     | Description                       |
| ---------------------------------- | ---------------------------------------- | --------------------------------- |
| `editprompt`                       | `editprompt open`                        | Open editor and send content      |
| `editprompt --resume`              | `editprompt resume`                      | Resume existing editor pane       |
| `editprompt -- "text"`             | `editprompt input -- "text"`             | Send content directly             |
| `editprompt --auto-send -- "text"` | `editprompt input --auto-send -- "text"` | Send content with auto-submit     |
| `editprompt --quote`               | `editprompt collect`                     | Collect quoted text               |
| `editprompt --capture`             | `editprompt dump`                        | Output and clear collected quotes |

## Detailed Migration Examples

### Basic Editor Launch

**Old:**

```bash
editprompt
editprompt --editor nvim
editprompt --always-copy
```

**New:**

```bash
editprompt open
editprompt open --editor nvim
editprompt open --always-copy
```

### Resume Mode

**Old:**

```bash
editprompt --resume --target-pane %123
```

**New:**

```bash
editprompt resume --target-pane %123
```

### Send Without Closing Editor

**Old:**

```bash
editprompt -- "your content"
editprompt --auto-send -- "your content"
editprompt --auto-send --send-key "C-m" -- "your content"
```

**New:**

```bash
editprompt input -- "your content"
editprompt input --auto-send -- "your content"
editprompt input --auto-send --send-key "C-m" -- "your content"
```

### Quote Collection

**Old:**

```bash
editprompt --quote --target-pane %123
```

**New:**

```bash
editprompt collect --target-pane %123
```

### Quote Capture

**Old:**

```bash
editprompt --capture
```

**New:**

```bash
editprompt dump
```

## Getting Help

### Subcommand List

Run `editprompt --help` to see all available subcommands:

```bash
$ editprompt --help
```

### Subcommand-Specific Help

Run `editprompt <subcommand> --help` for detailed help on each subcommand:

```bash
$ editprompt open --help
$ editprompt resume --help
$ editprompt input --help
$ editprompt collect --help
$ editprompt dump --help
```

## Troubleshooting

### Error: "Subcommand is required"

If you see this error, you're using the old syntax. Follow the migration table above to update your command.

```bash
# ❌ Old (will fail)
$ editprompt

# ✅ New
$ editprompt open
```

### Updated Bindings Not Working

After updating your configuration files:

1. **tmux**: Reload configuration with `tmux source-file ~/.tmux.conf` or restart tmux
2. **WezTerm**: Reload configuration with `Ctrl+Shift+R` or restart WezTerm
3. **Neovim**: restart Neovim

## Summary

1. **Update all commands** from option-based to subcommand-based syntax
2. **Update configuration files** (`.tmux.conf`, `wezterm.lua`, editor configs)
3. **Reload configurations** in your multiplexer and editor
4. **Use `--help`** to explore new subcommand interface
