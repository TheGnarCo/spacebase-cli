import { Command } from "commander";

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
