#!/usr/bin/env node
import { cli } from "gunshi";
import { extractRawContent } from "../../src/utils/argumentParser";

const argv = process.argv.slice(2);

await cli(argv, {
	name: "test-cli",
	description: "Test CLI for argument parsing",
	async run(ctx) {
		const result = extractRawContent(ctx.rest, ctx.positionals);
		console.log(result);
	},
});
