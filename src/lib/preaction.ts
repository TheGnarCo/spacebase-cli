import type { GlobalOpts } from "../cli";
import { loadCredentials, resolveProjectId } from "./auth";
import { setContext } from "./context";
import { output } from "./output";

const AUTH_EXEMPT_COMMANDS = ["link", "unlink"];

export async function runPreAction(opts: GlobalOpts, commandName?: string): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) return;

  if (commandName && AUTH_EXEMPT_COMMANDS.includes(commandName)) return;

  output.configure({ json: opts.json || !process.stdout.isTTY });

  const creds = await loadCredentials(opts);
  if (!creds) {
    output.error("Not authenticated. Run 'spacebase link' or set SPACEBASE_API_KEY.");
    process.exit(1);
  }

  const projectId = await resolveProjectId({
    flagValue: opts.project,
    apiKey: creds.apiKey,
    baseUrl: creds.baseUrl,
  });

  setContext({ apiKey: creds.apiKey, baseUrl: creds.baseUrl, projectId });
}
