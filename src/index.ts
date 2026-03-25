import { program } from "./cli";
import { CommanderError } from "commander";

try {
  await program.parseAsync(process.argv);
} catch (err) {
  if (err instanceof CommanderError) {
    process.exit(err.exitCode);
  }
  throw err;
}
