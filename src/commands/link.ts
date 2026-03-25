import { Command } from "commander";
import { writeFile, readFile, unlink as unlinkFile, access } from "fs/promises";
import { constants } from "fs";
import { join } from "path";
import type { GlobalOpts } from "../cli";
import { output, ColumnDef } from "../lib/output";

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
  .description("Link current directory to a Spacebase project")
  .argument("[project-id]", "project ID to link")
  .option("--status", "show resolved project context")
  .action(async function (this: Command, projectIdArg?: string) {
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

    let projectId = projectIdArg;

    if (!projectId) {
      projectId = await prompt("Project ID: ");
      if (!projectId) {
        process.stderr.write("Error: project ID is required\n");
        process.exit(1);
        return;
      }
    }

    const dotfilePath = join(process.cwd(), ".spacebase");
    await writeFile(dotfilePath, projectId + "\n", "utf8");
    process.stdout.write(`Linked to project ${projectId}\n`);
  });

export const unlinkCommand = new Command("unlink")
  .description("Remove project binding from current directory")
  .action(async function () {
    const dotfilePath = join(process.cwd(), ".spacebase");
    try {
      await unlinkFile(dotfilePath);
      process.stdout.write("Unlinked.\n");
    } catch {
      process.stdout.write("Nothing to unlink.\n");
    }
  });
