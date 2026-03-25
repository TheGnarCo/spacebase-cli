import { Command } from "commander";
import { writeFile, readFile, unlink as unlinkFile, access } from "fs/promises";
import { constants } from "fs";
import { join } from "path";
import type { GlobalOpts } from "../cli";
import { getContext } from "../lib/context";
import { saveCredentials, deleteCredentials, loadCredentials } from "../lib/auth";
import { output, ColumnDef } from "../lib/output";

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
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (chunk) => {
      resolve(chunk.toString().trim());
    });
    process.stdin.resume();
  });
}

async function resolveStatusSource(flagValue: string | undefined): Promise<{ projectId: string; source: string }> {
  if (flagValue) return { projectId: flagValue, source: "flag" };

  if (process.env.SPACEBASE_PROJECT_ID) {
    return { projectId: process.env.SPACEBASE_PROJECT_ID, source: "env" };
  }

  const dotfilePath = join(process.cwd(), ".spacebase");
  try {
    await access(dotfilePath, constants.R_OK);
    const content = await readFile(dotfilePath, "utf8");
    const trimmed = content.trim();
    if (trimmed) return { projectId: trimmed, source: "dotfile" };
  } catch {
    // not found
  }

  const ctx = getContext();
  return { projectId: ctx.projectId ?? "(none)", source: "api-key" };
}

export const linkCommand = new Command("link")
  .description("Link current directory to a Spacebase project")
  .option("--status", "show resolved project context")
  .action(async function (this: Command) {
    const opts = this.optsWithGlobals<GlobalOpts & { status?: boolean }>();

    if (opts.status) {
      const { projectId, source } = await resolveStatusSource(opts.project);
      const columns: ColumnDef[] = [
        { header: "Project ID", key: "projectId", width: 40 },
        { header: "Source", key: "source", width: 15 },
      ];
      output.table([{ projectId, source }], columns);
      return;
    }

    // Resolve API key: flag → env → stored credentials → prompt
    let apiKey = opts.apiKey;
    const baseUrl = opts.url ?? DEFAULT_BASE_URL;

    if (!apiKey) {
      const creds = await loadCredentials();
      if (creds) {
        apiKey = creds.apiKey;
      }
    }

    if (!apiKey) {
      apiKey = await prompt("API key (sw_...): ");
      if (!apiKey) {
        process.stderr.write("Error: API key is required\n");
        process.exit(1);
        return;
      }
    }

    // Verify the key and get project info
    const result = await verifyApiKey(apiKey, baseUrl);

    if (typeof result === "string") {
      process.stderr.write(`Error: ${result}\n`);
      process.exit(1);
      return;
    }

    // Save credentials
    await saveCredentials({ apiKey, baseUrl });

    // Resolve project ID: --project flag or auto-detect from API key
    const projectId = opts.project ?? result.project.id;

    // Write .spacebase dotfile
    const dotfilePath = join(process.cwd(), ".spacebase");
    await writeFile(dotfilePath, projectId + "\n", "utf8");

    process.stdout.write(`Linked to ${result.project.name} (${projectId})\n`);
  });

export const unlinkCommand = new Command("unlink")
  .description("Remove project binding and stored credentials")
  .action(async function () {
    const dotfilePath = join(process.cwd(), ".spacebase");
    let unlinkedDotfile = false;
    try {
      await unlinkFile(dotfilePath);
      unlinkedDotfile = true;
    } catch {
      // no dotfile
    }

    const deletedCreds = await deleteCredentials();

    if (unlinkedDotfile || deletedCreds) {
      process.stdout.write("Unlinked.\n");
    } else {
      process.stdout.write("Nothing to unlink.\n");
    }
  });
