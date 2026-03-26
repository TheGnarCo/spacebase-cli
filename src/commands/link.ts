import { Command } from "commander";
import { writeFile, readFile, unlink as unlinkFile, access } from "fs/promises";
import { constants } from "fs";
import { join } from "path";
import type { GlobalOpts } from "../cli";
import { output, ColumnDef } from "../lib/output";
import { saveCredentials, deleteCredentials } from "../lib/auth";

const DEFAULT_BASE_URL = "https://spacebase.thegnar.com";

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

  return { projectId: "(none)", source: "none" };
}

export const linkCommand = new Command("link")
  .description("Authenticate and link current directory to a Spacebase project")
  .argument("[api-key]", "Spacebase API key")
  .option("--status", "show resolved project context")
  .action(async function (this: Command, apiKeyArg?: string) {
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

    if (!apiKeyArg) {
      output.error("API key is required. Usage: spacebase link <api-key>");
      process.exit(1);
      return;
    }

    const baseUrl = opts.url ?? process.env.SPACEBASE_URL ?? DEFAULT_BASE_URL;

    // Validate the API key against /api/v1/me
    let meData: { type?: string; project?: { id?: string }; user?: { display_name?: string } };
    try {
      const response = await fetch(`${baseUrl}/api/v1/me`, {
        headers: {
          Authorization: `Bearer ${apiKeyArg}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        output.error(`Authentication failed (${response.status}). Check your API key.`);
        process.exit(1);
        return;
      }
      meData = await response.json() as typeof meData;
    } catch (err) {
      output.error(`Could not reach ${baseUrl}: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
      return;
    }

    // Save credentials
    await saveCredentials({ token: apiKeyArg, baseUrl });

    // Write project ID to .spacebase if available
    const projectId = meData.project?.id;
    if (projectId) {
      const dotfilePath = join(process.cwd(), ".spacebase");
      await writeFile(dotfilePath, projectId + "\n", "utf8");
      process.stdout.write(`Linked to project ${projectId}\n`);
    } else {
      process.stdout.write("Authenticated. No project associated with this key.\n");
    }
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
