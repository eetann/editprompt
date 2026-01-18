# Neovim Integration

This guide covers manual Neovim configuration for editprompt. For an easier setup, consider using [editprompt.nvim](https://github.com/eetann/editprompt.nvim).

## EDITPROMPT Environment Variable

editprompt automatically sets `EDITPROMPT=1` when launching your editor. This allows you to detect when your editor is launched by editprompt and enable specific configurations.

```lua
-- In your Neovim config (e.g., init.lua)
if vim.env.EDITPROMPT then
  vim.opt.wrap = true
  -- Add your editprompt-specific keymaps here
end
```

## Send Without Closing Editor

You can set up a keybinding to send your buffer content while keeping the editor open:

```lua
vim.keymap.set("n", "<Space>ei", function()
  vim.cmd("update")
  -- Get buffer content
  local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
  local content = table.concat(lines, "\n")

  -- Execute editprompt command
  vim.system(
    { "editprompt", "input", "--auto-send", "--", content },
    { text = true },
    function(obj)
      vim.schedule(function()
        if obj.code == 0 then
          -- Clear buffer on success
          vim.api.nvim_buf_set_lines(0, 0, -1, false, {})
          vim.cmd("silent write")
        else
          -- Show error notification
          vim.notify("editprompt failed: " .. (obj.stderr or "unknown error"), vim.log.levels.ERROR)
        end
      end)
    end
  )
end, { silent = true, desc = "Send buffer content to editprompt" })
```

**Usage:**
1. Open editprompt using the tmux/wezterm keybinding
2. Write your prompt in the editor
3. Press `<Space>ei` to send the content to the target pane
4. The buffer is automatically cleared on success
5. Continue editing to send more content

## Capture Collected Quotes

You can set up a keybinding to capture quote content from `editprompt dump`:

```lua
vim.keymap.set("n", "<Space>ec", function()
  vim.cmd("update")

  vim.system({ "editprompt", "dump" }, { text = true }, function(obj)
    vim.schedule(function()
      if obj.code == 0 then
        vim.cmd("silent write")
        -- Split stdout by lines
        local output_lines = vim.split(obj.stdout, "\n")

        local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
        local is_empty = #lines == 1 and lines[1] == ""

        if is_empty then
          -- If empty, overwrite from the beginning
          vim.api.nvim_buf_set_lines(0, 0, -1, false, output_lines)
          vim.cmd("normal 2j")
        else
          -- If not empty, append to the end
          table.insert(output_lines, 1, "")
          local line_count = vim.api.nvim_buf_line_count(0)
          vim.api.nvim_buf_set_lines(
            0,
            line_count,
            line_count,
            false,
            output_lines
          )
          vim.cmd("normal 4j")
        end

        vim.cmd("silent write")
      else
        vim.notify(
          "editprompt failed: " .. (obj.stderr or "unknown error"),
          vim.log.levels.ERROR
        )
      end
    end)
  end)
end, { silent = true, desc = "Capture from editprompt quote mode" })
```

## Prompt Stash

You can set up keybindings to stash and pop prompts:

```lua
-- Stash current buffer content
vim.keymap.set("n", "<Space>eS", function()
  local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
  local content = table.concat(lines, "\n")
  if content:gsub("%s", "") == "" then
    vim.notify("Buffer is empty", vim.log.levels.WARN)
    return
  end
  vim.system({ "editprompt", "stash", "push", "--", content }, { text = true }, function(obj)
    vim.schedule(function()
      if obj.code == 0 then
        vim.api.nvim_buf_set_lines(0, 0, -1, false, {})
        vim.notify("Prompt stashed", vim.log.levels.INFO)
      else
        vim.notify("Stash failed: " .. (obj.stderr or "unknown error"), vim.log.levels.ERROR)
      end
    end)
  end)
end, { silent = true, desc = "Stash buffer content" })

-- Pop latest stashed prompt into buffer
vim.keymap.set("n", "<Space>es", function()
  vim.system({ "editprompt", "stash", "pop" }, { text = true }, function(obj)
    vim.schedule(function()
      if obj.code == 0 and obj.stdout ~= "" then
        local lines = vim.split(obj.stdout, "\n")
        vim.api.nvim_buf_set_lines(0, 0, -1, false, lines)
        vim.notify("Prompt popped", vim.log.levels.INFO)
      else
        vim.notify("No stash entries found", vim.log.levels.WARN)
      end
    end)
  end)
end, { silent = true, desc = "Pop stashed prompt" })
```
