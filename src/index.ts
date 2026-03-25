import { program } from "./cli";
import { CommanderError } from "commander";
import { ApiError } from "./lib/http";

try {
  await program.parseAsync(process.argv);
} catch (err) {
  if (err instanceof CommanderError) {
    process.exit(err.exitCode);
  }
  if (err instanceof ApiError) {
    const detail = typeof err.body === "object" && err.body !== null
      ? (err.body as Record<string, unknown>).message ?? (err.body as Record<string, unknown>).error
      : err.body;
    process.stderr.write(`Error: ${err.status} ${err.statusText}`);
    if (detail) {
      process.stderr.write(` — ${detail}`);
    }
    process.stderr.write("\n");
    process.exit(1);
  }
  throw err;
}
