# Subcommand Implementation Details

This document provides technical details about how each subcommand works, including constraints and solutions for different terminal multiplexers.

## Available Subcommands

- open
- register
- resume
- input
- collect
- dump
- stash

---

## open Subcommand

### Purpose

Launches an editor, waits for content to be written, and sends it to the target pane when the editor closes.

### Multiple Target Panes Support

The `--target-pane` option can be specified multiple times. Content is sent sequentially to all specified panes.

```bash
# Example: sending to multiple panes
editprompt open --target-pane %1 --target-pane %2 --target-pane %3
```

- If all panes receive content successfully: exit code 0
- If some or all panes fail to receive content: exit code 1

### Constraints and Solutions

#### tmux with `run-shell`
- **Constraint**: `run-shell` creates a new shell process that does not inherit environment variables like `$EDITOR` from the parent shell
- **Solution**: Explicitly specify the editor using `--editor nvim`

```tmux
# Environment variables are not inherited, so explicitly specify the editor
bind -n M-q run-shell 'editprompt open --editor nvim --target-pane #{pane_id}'
```

#### WezTerm with `SplitPane`
- **Constraint**: `SplitPane` performs simple command execution without loading login shell configuration (PATH, etc.)
- **Solution**: Explicitly launch a login shell with `/bin/zsh -lc "editprompt ..."` to load environment variables and PATH

```lua
-- Use -lc flag to launch as login shell and load environment variables and PATH
SplitPane({
  command = {
    args = {
      "/bin/zsh",
      "-lc",
      "editprompt open --editor nvim --target-pane " .. target_pane_id,
    },
  },
})
```

---

## register Subcommand

### Purpose

Registers the relationship between editor panes and target panes. Enables bidirectional focus switching in resume mode and content delivery in input mode.

### Usage Examples

```bash
# Register target panes to the current pane (editor pane)
editprompt register --target-pane %1 --target-pane %2

# Explicitly specify editor pane ID for registration
editprompt register --editor-pane %10 --target-pane %1 --target-pane %2
```

### Behavior

1. **Determine editor pane**:
   - If `--editor-pane` option is specified: Use that ID
   - If not specified: Use the current pane as the editor pane
   - Error if the current pane is not an editor pane

2. **Merge with existing target panes**:
   - Retrieve existing target pane IDs already registered to the editor pane
   - Merge with newly specified target pane IDs
   - Remove duplicates to create a unique array

3. **Save relationship**:
   - **tmux**: Save as comma-separated values in `@editprompt_target_panes` pane variable
   - **WezTerm**: Save `targetPaneIds` as an array using Conf library

---

## resume Subcommand

### Purpose

Reuses existing editor panes and enables bidirectional focus switching between target and editor panes.

### Constraints and Solutions

This mode needs to maintain the relationship between editor panes and target panes, enabling bidirectional focus switching.

#### tmux Implementation
- **Solution**: Use tmux pane variables (`@variable`) to persist data
- **Variables used**:
  - `@editprompt_editor_pane`: Set on target pane, stores editor pane ID
  - `@editprompt_is_editor`: Set on editor pane, flag indicating it's an editor pane
  - `@editprompt_target_panes`: Set on editor pane, stores original target pane IDs as comma-separated values

```bash
# Save editor pane ID on target pane
tmux set-option -pt '${targetPaneId}' @editprompt_editor_pane '${editorPaneId}'

# Save flag and multiple target pane IDs on editor pane
tmux set-option -pt '${editorPaneId}' @editprompt_is_editor 1
tmux set-option -pt '${editorPaneId}' @editprompt_target_panes '${targetPaneId1},${targetPaneId2}'
```

When switching back from the editor pane, it focuses on the first existing pane among the saved target pane IDs (retry logic).

While tmux's `run-shell` does not inherit environment variables, it can access pane variables like `#{pane_id}`, making this approach work seamlessly.

#### WezTerm Implementation
- **Constraint**: WezTerm's `run_child_process` does not inherit environment variables or PATH, requiring execution via `/bin/zsh -lc`
- **Constraint**: WezTerm does not have a pane variable mechanism like tmux
- **About OSC User Variables**: WezTerm supports [user variable definition via OSC 1337](https://wezfurlong.org/wezterm/shell-integration.html#user-vars), but this method **cannot be used for panes running active processes**
  - OSC user variables are meant to be set during shell prompt display and similar events; they cannot be set externally on target panes already running processes like Claude Code
  - Editor panes also run processes like nvim after launch, facing the same constraint
- **Solution**: Use the [Conf](https://github.com/sindresorhus/conf) library to persist data to the filesystem
  - `wezterm.targetPane.pane_${targetPaneId}`: Stores editor pane ID
  - `wezterm.editorPane.pane_${editorPaneId}`: Stores multiple target pane IDs as an array

```typescript
// Use Conf library to save the relationship between target and editor panes
conf.set(`wezterm.targetPane.pane_${targetPaneId}`, {
  editorPaneId: editorPaneId,
});
conf.set(`wezterm.editorPane.pane_${editorPaneId}`, {
  targetPaneIds: [targetPaneId1, targetPaneId2],
});
```

When switching back from the editor pane, it focuses on the first existing target pane, similar to tmux.

This approach enables bidirectional focus switching in WezTerm, similar to tmux.

---

## input Subcommand

### Purpose

Sends content to the target pane without opening an editor, designed to be executed from within an editor session.

### Mechanism

This mode is designed to be executed from within the editor, reading configuration from both environment variables and pane variables/Conf.

#### Workflow
1. **When launching the editor in open subcommand**:
   - The following environment variables are set when launching the editor:
     - `EDITPROMPT_MUX`: Multiplexer to use (`tmux` or `wezterm`)
     - `EDITPROMPT_ALWAYS_COPY`: Clipboard copy configuration
     - `EDITPROMPT=1`: Flag indicating launched by editprompt
   - Target pane IDs are stored in pane variables or Conf:
     - tmux: `@editprompt_target_panes` (comma-separated)
     - wezterm: `targetPaneIds` (array)

2. **When executing input subcommand from within the editor**:
   - Execute `editprompt input -- "content"` from editors like Neovim
   - Inherits environment variables from the parent process (editor)
   - Gets the current pane ID and reads multiple target pane IDs from pane variables/Conf
   - Sends content sequentially to each target pane

```lua
-- Example execution from Neovim
vim.system(
  { "editprompt", "input", "--", content },
  { text = true },
  function(obj)
    -- Environment variables are properly inherited when executed from the editor
  end
)
```

### Benefits
- Send content multiple times without closing the editor
- Environment variable inheritance happens naturally, requiring no additional configuration or arguments
- Supports sending to multiple target panes

---

## collect Subcommand

### Purpose

Collects text selections and stores them as quoted text (with `> ` prefix) in pane variables or persistent storage. Used to accumulate multiple selections for later retrieval with dump subcommand.

### Mechanism

This mode enables collecting multiple text selections while reading AI responses or terminal output, preparing them for a reply with context.

#### Text Input Methods

**tmux Implementation:**
- Reads text from stdin using pipe in copy mode
- Example: `bind-key -T copy-mode-vi C-e { send-keys -X pipe "editprompt collect --target-pane #{pane_id}" }`
- Example (also send cleaned text to clipboard without quote prefix):  
  `bind-key -T copy-mode-vi y { send-keys -X pipe "editprompt collect --target-pane #{pane_id} --output buffer --output stdout --no-quote | pbcopy" }`

**WezTerm Implementation:**
- Receives text as a positional argument
- Example: `editprompt collect --mux wezterm --target-pane <id> -- "<text>"`
- Uses `wezterm.shell_quote_arg()` for proper escaping

#### Text Processing

The `processQuoteText` function applies intelligent text formatting:

1. **Remove leading/trailing newlines**: Cleans up selection boundaries
2. **Pattern Detection**: Analyzes indentation structure
   - **Pattern A** (No leading whitespace in 2nd+ lines): Preserves all line breaks, removes only leading whitespace
   - **Pattern B** (Common leading whitespace): Removes common indentation and merges lines with exceptions:
     - Never merges lines starting with Markdown list markers (`-`, `*`, `+`)
     - Never merges when both lines contain colons (`:` or `：`)
     - Adds space separator between lines only when both end/start with alphabetic characters
3. **Add quote prefix**: Prepends `> ` to each line
4. **Add trailing newlines**: Appends two newlines for separation between multiple quotes
5. **Disable quote formatting when needed**: Use `--no-quote` to skip adding `> ` and the trailing blank lines (indent/newline cleanup still applies)

#### Output Destinations

- Default: `--output buffer` (store in tmux pane variable / WezTerm Conf)
- Tee to stdout: `--output buffer --output stdout` to pipe the same processed text to another command (e.g., clipboard)
- `--no-quote` applies to all outputs, producing cleaned text without Markdown quote prefix or trailing blank lines

#### Storage Implementation

**tmux Implementation:**
- Stores accumulated quotes in `@editprompt_quote` pane variable
- Appends new quotes to existing content with newline separator
- Single quote escaping: Uses `'\''` pattern for shell safety

```bash
# Append to existing quote content
tmux set-option -pt '${paneId}' @editprompt_quote '${newContent}'
```

**WezTerm Implementation:**
- Stores quotes in Conf library under `wezterm.targetPane.pane_${paneId}.quote_text`
- Appends new quotes to existing content with newline separator

```typescript
// Append to existing quote content
const existingQuotes = conf.get(`wezterm.targetPane.pane_${paneId}.quote_text`) || '';
const newQuotes = existingQuotes + '\n' + content;
conf.set(`wezterm.targetPane.pane_${paneId}.quote_text`, newQuotes);
```

### Benefits
- Collect multiple selections from long AI responses or terminal output
- Intelligent text processing removes formatting artifacts
- Quotes are automatically formatted in Markdown quote style
- Persistent storage survives across multiple selections

---

## dump Subcommand

### Purpose

Retrieves all accumulated quoted text from collect subcommand and outputs it to stdout, then clears the storage. Designed to be executed from within an editor session to insert collected quotes.

### Mechanism

This mode is designed to work with the collect subcommand workflow, retrieving accumulated selections for editing and replying.

#### Configuration Source

Unlike collect subcommand which requires `--target-pane` argument, dump subcommand reads configuration from environment variables and pane variables/Conf:
- `EDITPROMPT_MUX`: Multiplexer type (`tmux` or `wezterm`)
- Multiple target pane IDs retrieved from current pane ID:
  - tmux: `@editprompt_target_panes` (comma-separated)
  - wezterm: `targetPaneIds` (array)

These configurations are automatically set when launching the editor in open subcommand.

#### Workflow

1. **Read environment variables**: Gets multiplexer type from environment
2. **Get current pane ID**: Identifies the editor pane ID
3. **Get target pane IDs**: Retrieves multiple target pane IDs from pane variables/Conf
4. **Retrieve quote content**: Fetches accumulated quotes from all target panes
   - **tmux**: Reads from `@editprompt_quote` pane variable
   - **WezTerm**: Reads from `wezterm.targetPane.pane_${paneId}.quote_text` in Conf
5. **Clear storage**: Removes quote content from storage for each target pane after retrieval
   - **tmux**: Sets `@editprompt_quote` to empty string
   - **WezTerm**: Deletes `quote_text` key from Conf
6. **Combine and output**: Joins all quotes with newlines and writes to stdout with trailing newline cleanup (max 2 newlines)

```typescript
// Combine and output with cleaned trailing newlines
const combinedContent = quoteContents.join("\n");
process.stdout.write(combinedContent.replace(/\n{3,}$/, "\n\n"));
```

#### Storage Retrieval

**tmux Implementation:**
```bash
# Get quote content
tmux show -pt '${paneId}' -v @editprompt_quote

# Clear quote content
tmux set-option -pt '${paneId}' @editprompt_quote ""
```

**WezTerm Implementation:**
```typescript
// Get quote content
const data = conf.get(`wezterm.targetPane.pane_${paneId}`);
const quoteContent = data?.quote_text || '';

// Clear quote content
conf.delete(`wezterm.targetPane.pane_${paneId}.quote_text`);
```

### Benefits
- Retrieves all accumulated quotes in a single command
- Automatically combines quotes from multiple target panes
- Automatically clears storage for next collection session
- Works seamlessly from within editor via environment variable inheritance
- No need to specify target pane or multiplexer type manually

---

## stash Subcommand

### Purpose

Temporarily stores prompts for later use, similar to `git stash`. Useful for saving prompt ideas while working on something else, then retrieving them later.

### Subcommands

| Subcommand | Description |
|------------|-------------|
| `push -- "<content>"` | Save content to stash |
| `list` | List all stashed entries as JSON |
| `apply [--key <key>]` | Output stashed content (latest by default) |
| `drop [--key <key>]` | Remove stashed entry (latest by default) |
| `pop [--key <key>]` | Apply and drop stashed entry |

### Mechanism

This command is designed to be executed from within an editor pane launched by editprompt.

#### Storage

All stash operations use the Conf library for persistent storage, regardless of multiplexer type (tmux or WezTerm).

**Storage Key Structure:**
```typescript
`${mux}.targetPane.pane_${targetPaneId}.stash`
```

**Data Structure:**
```typescript
{
  "2025-01-07T12:34:56.789Z": "content1",
  "2025-01-07T12:35:00.123Z": "content2",
  // ISO datetime string as key, content as value
}
```

#### Workflow

1. **Determine editor pane**: Reads `EDITPROMPT_MUX` environment variable to identify multiplexer type
2. **Get current pane ID**: Identifies the current pane as the editor pane
3. **Verify editor pane**: Checks that the current pane is registered as an editor pane
4. **Get target pane ID**: Retrieves target pane ID from pane variables (tmux) or Conf (WezTerm)
5. **Perform stash operation**: Execute the requested subcommand (push/list/apply/drop/pop)

#### Subcommand Details

**push:**
- Takes content from positional arguments after `--`
- Generates ISO datetime key for the entry
- Appends to existing stash data
- Outputs the generated key for reference

**list:**
- Returns all stash entries as JSON array
- Sorted by key in descending order (newest first)
- Format: `[{ "key": "...", "content": "..." }, ...]`

**apply:**
- Outputs stash content to stdout
- If `--key` specified: retrieves that specific entry
- If no key: retrieves the latest entry (max key)
- Does not modify stash storage

**drop:**
- Removes entry from stash storage
- If `--key` specified: removes that specific entry
- If no key: removes the latest entry (max key)
- Returns error if entry not found

**pop:**
- Combines apply and drop operations
- Outputs content to stdout, then removes the entry
- Useful for one-time retrieval

### Benefits

- Save prompt ideas without losing them when switching contexts
- Multiple stash entries can be stored and managed independently
- Git-like interface familiar to developers
- Persistent storage survives editor restarts
- Works seamlessly from within editor via environment variable inheritance
