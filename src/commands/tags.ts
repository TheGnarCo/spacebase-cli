import { Command } from "commander";
import { getContext } from "../lib/context";
import { apiFetchJson } from "../lib/http";
import { output, ColumnDef } from "../lib/output";

interface Tag {
  id: string;
  name: string;
}

class MissingProjectIdError extends Error {
  constructor() {
    super("Project ID is required. Use --project, SPACEBASE_PROJECT_ID, or link a project.");
    this.name = "MissingProjectIdError";
  }
}

function requireProjectId(projectId: string | undefined): asserts projectId is string {
  if (!projectId) {
    throw new MissingProjectIdError();
  }
}

async function wrapAction(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof MissingProjectIdError) {
      output.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

const listCommand = new Command("list")
  .description("List tags in a project")
  .action(async function () {
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);
      const tags = await apiFetchJson<Tag[]>(`/projects/${ctx.projectId}/tags`);
      const columns: ColumnDef[] = [
        { header: "ID", key: "id", width: 20 },
        { header: "Name", key: "name", width: 30 },
      ];
      output.table(tags, columns);
    });
  });

export const tagsCommand = new Command("tags")
  .description("Manage project tags")
  .addCommand(listCommand);
