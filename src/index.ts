#!/usr/bin/env node
import { getLogger } from "@logtape/logtape";
import { cli } from "gunshi";
import { setupLogger } from "./modules/logger";
import * as pkg from "../package.json";
import { collectCommand } from "./modes/collect";
import { dumpCommand } from "./modes/dump";
import { inputCommand } from "./modes/input";
import { openCommand } from "./modes/openEditor";
import { registerCommand } from "./modes/register";
import { resumeCommand } from "./modes/resume";
import { stashCommand } from "./modes/stash";

const argv = process.argv.slice(2);

await cli(
  argv,
  {
    name: "editprompt",
    description:
      "A CLI tool that lets you write prompts for CLI tools using your favorite text editor",
    args: {},
    async run() {
      setupLogger();
      const logger = getLogger(["editprompt"]);
      // Subcommand is required - show migration guide
      logger.error("Subcommand is required");
      logger.error("");
      logger.error("Migration guide from old to new syntax:");
      logger.error("  editprompt           → editprompt open");
      logger.error("  editprompt --resume  → editprompt resume");
      logger.error('  editprompt -- "text" → editprompt input "text"');
      logger.error("  editprompt --quote   → editprompt collect");
      logger.error("  editprompt --capture → editprompt dump");
      logger.error("");
      logger.error("For details: https://github.com/eetann/editprompt/?tab=readme-ov-file");
      process.exit(1);
    },
  },
  {
    name: "editprompt",
    version: pkg.version,
    subCommands: {
      open: openCommand,
      register: registerCommand,
      resume: resumeCommand,
      input: inputCommand,
      collect: collectCommand,
      dump: dumpCommand,
      stash: stashCommand,
    },
    renderHeader: null,
  },
);
