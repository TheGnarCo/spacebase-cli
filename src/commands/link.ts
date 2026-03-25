import { Command } from "commander";
import { writeFile, readFile, unlink, access } from "fs/promises";
import { constants } from "fs";
import { join } from "path";
import type { GlobalOpts } from "../cli";
import { getContext } from "../lib/context";
import { apiFetchJson } from "../lib/http";
import { output, ColumnDef } from "../lib/output";

interface MeResponse {
  user: { email: string };
  project: { id: string; name: string };
}

async function resolveLinkProjectId(flagValue: string | undefined): Promise<string> {
  if (flagValue) return flagValue;

  const data = await apiFetchJson<MeResponse>("/api/v1/me");
  return data.project.id;
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

    const projectId = await resolveLinkProjectId(opts.project);
    const dotfilePath = join(process.cwd(), ".spacebase");
    await writeFile(dotfilePath, projectId + "\n", "utf8");
    process.stdout.write(`Linked to project ${projectId}\n`);
  });

export const unlinkCommand = new Command("unlink")
  .description("Remove .spacebase project binding from current directory")
  .action(async function () {
    const dotfilePath = join(process.cwd(), ".spacebase");
    try {
      await unlink(dotfilePath);
      process.stdout.write("Unlinked.\n");
    } catch {
      process.stdout.write("No .spacebase file found.\n");
    }
  });
