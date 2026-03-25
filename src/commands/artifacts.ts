import { Command } from "commander";
import { readFile, writeFile } from "fs/promises";
import { basename } from "path";
import { getContext } from "../lib/context";
import { requireProjectId, wrapAction } from "../lib/errors";
import { apiFetch, apiFetchJson, apiFetchFormData } from "../lib/http";
import { output, ColumnDef } from "../lib/output";

interface Artifact {
  id: string;
  filename: string;
  tags: string[];
  created_at: string;
}

const listCommand = new Command("list")
  .description("List artifacts in a project")
  .action(async function (this: Command) {
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);
      const artifacts = await apiFetchJson<Artifact[]>(`/projects/${ctx.projectId}/artifacts`);
      const columns: ColumnDef[] = [
        { header: "ID", key: "id", width: 20 },
        { header: "Filename", key: "filename", width: 30 },
        { header: "Tags", key: "tags", width: 20 },
        { header: "Created At", key: "created_at", width: 24 },
      ];
      const rows = artifacts.map((a) => ({
        ...a,
        tags: Array.isArray(a.tags) ? a.tags.join(", ") : String(a.tags),
      }));
      output.table(rows, columns);
    });
  });

const uploadCommand = new Command("upload")
  .description("Upload a file as an artifact")
  .argument("<file>", "Path to file to upload")
  .option("--tags <tags>", "Comma-separated tags to apply")
  .action(async function (this: Command, file: string) {
    const opts = this.optsWithGlobals<{ tags?: string }>();
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);

      const fileContent = await readFile(file);
      const form = new FormData();
      form.append("file", new Blob([fileContent]), basename(file));
      if (opts.tags) {
        form.append("tags", opts.tags);
      }

      const artifact = await apiFetchFormData<Artifact>(
        `/projects/${ctx.projectId}/artifacts`,
        form,
      );
      process.stdout.write(`Uploaded artifact ${artifact.id}\n`);
    });
  });

const downloadCommand = new Command("download")
  .description("Download an artifact")
  .argument("<artifactId>", "Artifact ID")
  .option("--out <path>", "Write to file instead of stdout")
  .action(async function (this: Command, artifactId: string) {
    const opts = this.optsWithGlobals<{ out?: string }>();
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);

      const response = await apiFetch(`/projects/${ctx.projectId}/artifacts/${artifactId}`);
      const buffer = await response.arrayBuffer();

      if (opts.out) {
        await writeFile(opts.out, Buffer.from(buffer));
      } else {
        process.stdout.write(Buffer.from(buffer));
      }
    });
  });

const deleteCommand = new Command("delete")
  .description("Delete an artifact")
  .argument("<artifactId>", "Artifact ID")
  .action(async function (this: Command, artifactId: string) {
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);
      await apiFetch(`/projects/${ctx.projectId}/artifacts/${artifactId}`, { method: "DELETE" });
      process.stdout.write(`Deleted artifact ${artifactId}\n`);
    });
  });

const tagsCommand = new Command("tags")
  .description("Get or set tags on an artifact")
  .argument("<artifactId>", "Artifact ID")
  .option("--set <tags>", "Comma-separated tags to set (replaces existing)")
  .action(async function (this: Command, artifactId: string) {
    const opts = this.optsWithGlobals<{ set?: string }>();
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);

      if (opts.set) {
        const tags = opts.set.split(",").map((t) => t.trim());
        const result = await apiFetchJson<string[]>(
          `/projects/${ctx.projectId}/artifacts/${artifactId}/tags`,
          {
            method: "PUT",
            body: JSON.stringify(tags),
          }
        );
        const columns: ColumnDef[] = [{ header: "Tag", key: "tag", width: 30 }];
        output.table(result.map((t) => ({ tag: t })), columns);
      } else {
        const tags = await apiFetchJson<string[]>(
          `/projects/${ctx.projectId}/artifacts/${artifactId}/tags`
        );
        const columns: ColumnDef[] = [{ header: "Tag", key: "tag", width: 30 }];
        output.table(tags.map((t) => ({ tag: t })), columns);
      }
    });
  });

export const artifactsCommand = new Command("artifacts")
  .description("Manage project artifacts")
  .addCommand(listCommand)
  .addCommand(uploadCommand)
  .addCommand(downloadCommand)
  .addCommand(deleteCommand)
  .addCommand(tagsCommand);
