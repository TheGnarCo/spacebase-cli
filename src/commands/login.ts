import { Command } from "commander";
import type { GlobalOpts } from "../cli";
import { saveCredentials } from "../lib/auth";

const DEFAULT_BASE_URL = "https://spacebase.thegnar.com";

interface AuthResponse {
  token: string;
}

interface MeResponse {
  type: "session";
  user: { id: string; username: string; display_name: string; role: string };
}

function prompt(message: string): Promise<string> {
  process.stdout.write(message);
  return new Promise((resolve) => {
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (chunk) => {
      resolve(chunk.toString().trim());
    });
    process.stdin.resume();
  });
}

async function promptPassword(message: string): Promise<string> {
  process.stderr.write(message);
  if (typeof process.stdin.setRawMode === "function") {
    process.stdin.setRawMode(true);
  }
  process.stdin.setEncoding("utf8");
  process.stdin.resume();

  return new Promise((resolve) => {
    let input = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          if (typeof process.stdin.setRawMode === "function") {
            process.stdin.setRawMode(false);
          }
          process.stdin.pause();
          process.stdin.removeListener("data", onData);
          process.stderr.write("\n");
          resolve(input);
          return;
        } else if (char === "\u007F" || char === "\b") {
          input = input.slice(0, -1);
        } else if (char === "\u0003") {
          // Ctrl+C
          if (typeof process.stdin.setRawMode === "function") {
            process.stdin.setRawMode(false);
          }
          process.exit(130);
        } else {
          input += char;
        }
      }
    };
    process.stdin.on("data", onData);
  });
}

export const loginCommand = new Command("login")
  .description("Authenticate with username and password")
  .option("-u, --username <username>", "username")
  .action(async function (this: Command) {
    const opts = this.optsWithGlobals<GlobalOpts & { username?: string }>();
    const baseUrl = opts.url ?? DEFAULT_BASE_URL;

    const username = opts.username ?? await prompt("Username: ");
    if (!username) {
      process.stderr.write("Error: username is required\n");
      process.exit(1);
      return;
    }

    const password = await promptPassword("Password: ");
    if (!password) {
      process.stderr.write("Error: password is required\n");
      process.exit(1);
      return;
    }

    let authResponse: Response;
    try {
      authResponse = await fetch(`${baseUrl}/api/v1/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
      return;
    }

    if (!authResponse.ok) {
      const status = `${authResponse.status} ${authResponse.statusText}`;
      process.stderr.write(`Error: authentication failed (${status})\n`);
      process.exit(1);
      return;
    }

    const { token } = (await authResponse.json()) as AuthResponse;
    await saveCredentials({ token, baseUrl });

    // Fetch user info for display
    try {
      const meResponse = await fetch(`${baseUrl}/api/v1/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meResponse.ok) {
        const me = (await meResponse.json()) as MeResponse;
        process.stdout.write(`Logged in as ${me.user.display_name} (${me.user.username})\n`);
        return;
      }
    } catch {
      // fall through to generic message
    }

    process.stdout.write("Logged in.\n");
  });
