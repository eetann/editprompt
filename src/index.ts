#!/usr/bin/env node
import { cli } from "gunshi";
import * as pkg from "../package.json";
import { collectCommand } from "./modes/collect";
import { dumpCommand } from "./modes/dump";
import { inputCommand } from "./modes/input";
import { openCommand } from "./modes/openEditor";
import { resumeCommand } from "./modes/resume";

const argv = process.argv.slice(2);

await cli(
  argv,
  {
    name: "editprompt",
    description:
      "A CLI tool that lets you write prompts for CLI tools using your favorite text editor",
    args: {},
    async run() {
      // Subcommand is required - show migration guide
      console.error("Error: Subcommand is required");
      console.error("");
      console.error("Migration guide from old to new syntax:");
      console.error("  editprompt           → editprompt open");
      console.error("  editprompt --resume  → editprompt resume");
      console.error('  editprompt -- "text" → editprompt input "text"');
      console.error("  editprompt --quote   → editprompt collect");
      console.error("  editprompt --capture → editprompt dump");
      console.error("");
      console.error(
        "For details: https://github.com/eetann/editprompt/?tab=readme-ov-file",
      );
      process.exit(1);
    },
  },
  {
    name: "editprompt",
    version: pkg.version,
    subCommands: {
      open: openCommand,
      resume: resumeCommand,
      input: inputCommand,
      collect: collectCommand,
      dump: dumpCommand,
    },
    renderHeader: null,
  },
);
