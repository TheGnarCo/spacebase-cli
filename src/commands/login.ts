import { Command } from "commander";
import type { GlobalOpts } from "../cli";
import { saveCredentials } from "../lib/auth";

const DEFAULT_BASE_URL = "https://spacebase.thegnar.com";

interface MeResponse {
  user: { email: string };
  project: { id: string; name: string };
}

async function verifyApiKey(apiKey: string, baseUrl: string): Promise<MeResponse | string> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v1/me`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }

  if (!response.ok) {
    return `authentication failed (${response.status} ${response.statusText})`;
  }

  return (await response.json()) as MeResponse;
}

async function prompt(message: string): Promise<string> {
  process.stdout.write(message);
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (chunk) => {
      data = chunk.toString().trim();
      resolve(data);
    });
    process.stdin.resume();
  });
}

export const loginCommand = new Command("login")
  .description("Authenticate with a Spacebase API key")
  .action(async function (this: Command) {
    const opts = this.optsWithGlobals<GlobalOpts>();
    let apiKey = opts.apiKey;
    const baseUrl = opts.url ?? DEFAULT_BASE_URL;

    if (!apiKey) {
      apiKey = await prompt("API key (sw_...): ");
      if (!apiKey) {
        process.stderr.write("Error: API key is required\n");
        process.exit(1);
        return;
      }
    }

    const result = await verifyApiKey(apiKey, baseUrl);

    if (typeof result === "string") {
      process.stderr.write(`Error: ${result}\n`);
      process.exit(1);
      return;
    }

    await saveCredentials({ apiKey, baseUrl });
    process.stdout.write(`Logged in to ${result.project.name} (${result.project.id})\n`);
  });
