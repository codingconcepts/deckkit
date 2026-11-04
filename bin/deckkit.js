#!/usr/bin/env node

/* The command line, which is one command.

   `export` is the only thing a deck needs from a terminal - everything
   else it does, it does in a browser - but it's dispatched as a
   subcommand rather than assumed, so the day there's a second one the
   first one's invocation doesn't change. */

const [command, ...rest] = process.argv.slice(2);

const USAGE = `deckkit <command>

  export    record the deck as mp4 or gif  (deckkit export --help)
`;

if (command === "export") {
  const { main } = await import("../src/export/cli.js");
  process.exitCode = await main(rest);
} else if (!command || command === "--help" || command === "-h" || command === "help") {
  process.stdout.write(USAGE);
  process.exitCode = command ? 0 : 1;
} else {
  process.stderr.write(`deckkit: unknown command "${command}"\n\n${USAGE}`);
  process.exitCode = 1;
}
