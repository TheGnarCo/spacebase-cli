import { Command } from "commander";
import { getContext } from "../lib/context";
import { requireProjectId, wrapAction } from "../lib/errors";
import { apiFetchJson } from "../lib/http";
import { output, ColumnDef } from "../lib/output";

interface Tag {
  id: string;
  name: string;
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
