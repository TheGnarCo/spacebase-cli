import { Command } from "commander";
import { runPreAction } from "./lib/preaction";
import { whoamiCommand } from "./commands/whoami";
import { logoutCommand } from "./commands/logout";
import { loginCommand } from "./commands/login";

export interface GlobalOpts {
  json: boolean;
  verbose: boolean;
  project?: string;
  url?: string;
  apiKey?: string;
}

export const program = new Command();

program
  .name("spacebase")
  .description("CLI for the Spacebase API")
  .exitOverride()
  .showSuggestionAfterError()
  .option("--json", "output as JSON", false)
  .option("--verbose", "enable verbose request/response logging", false)
  .option("--project <id>", "project ID")
  .option("--url <url>", "Spacebase API base URL")
  .option("--api-key <key>", "Spacebase API key");

program.hook("preAction", async (_thisCommand, actionCommand) => {
  const opts = actionCommand.optsWithGlobals<GlobalOpts>();
  await runPreAction(opts, actionCommand.name());
});

program.addCommand(loginCommand);
program.addCommand(whoamiCommand);
program.addCommand(logoutCommand);
