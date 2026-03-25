import { Command } from "commander";
import { readFile } from "fs/promises";
import type { GlobalOpts } from "../cli";
import { getContext } from "../lib/context";
import { apiFetch, apiFetchJson } from "../lib/http";
import { output, ColumnDef } from "../lib/output";

interface Doc {
  id: string;
  title: string;
  folder: string | null;
  locked: boolean;
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
  .description("List documents in a project")
  .action(async function (this: Command) {
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);
      const docs = await apiFetchJson<Doc[]>(`/projects/${ctx.projectId}/docs`);
      const columns: ColumnDef[] = [
        { header: "ID", key: "id", width: 20 },
        { header: "Title", key: "title", width: 40 },
        { header: "Folder", key: "folder", width: 20 },
        { header: "Locked", key: "locked", width: 8 },
      ];
      output.table(docs, columns);
    });
  });

const getCommand = new Command("get")
  .description("Get raw markdown content of a document")
  .argument("<docId>", "Document ID")
  .action(async function (this: Command, docId: string) {
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);
      const response = await apiFetch(`/projects/${ctx.projectId}/docs/${docId}/raw`);
      const text = await response.text();
      process.stdout.write(text);
    });
  });

const createCommand = new Command("create")
  .description("Create a new document")
  .argument("<title>", "Document title")
  .option("--file <path>", "Read content from file")
  .option("--folder <folder>", "Folder to place the document in")
  .action(async function (this: Command, title: string) {
    const opts = this.optsWithGlobals<GlobalOpts & { file?: string; folder?: string }>();
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);

      const body: Record<string, unknown> = { title };
      if (opts.folder) body.folder = opts.folder;
      if (opts.file) {
        body.content = await readFile(opts.file, "utf8");
      }

      const doc = await apiFetchJson<Doc>(`/projects/${ctx.projectId}/docs`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      process.stdout.write(`Created document ${doc.id}\n`);
    });
  });

const updateCommand = new Command("update")
  .description("Update a document")
  .argument("<docId>", "Document ID")
  .option("--file <path>", "Read content from file")
  .option("--title <title>", "New title")
  .option("--folder <folder>", "New folder")
  .action(async function (this: Command, docId: string) {
    const opts = this.optsWithGlobals<GlobalOpts & { file?: string; title?: string; folder?: string }>();
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);

      const body: Record<string, unknown> = {};
      if (opts.title) body.title = opts.title;
      if (opts.folder) body.folder = opts.folder;
      if (opts.file) {
        body.content = await readFile(opts.file, "utf8");
      }

      const doc = await apiFetchJson<Doc>(`/projects/${ctx.projectId}/docs/${docId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      process.stdout.write(`Updated document ${doc.id}\n`);
    });
  });

const deleteCommand = new Command("delete")
  .description("Delete a document")
  .argument("<docId>", "Document ID")
  .action(async function (this: Command, docId: string) {
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);
      await apiFetch(`/projects/${ctx.projectId}/docs/${docId}`, { method: "DELETE" });
      process.stdout.write(`Deleted document ${docId}\n`);
    });
  });

const lockCommand = new Command("lock")
  .description("Toggle lock on a document")
  .argument("<docId>", "Document ID")
  .action(async function (this: Command, docId: string) {
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);
      const doc = await apiFetchJson<Doc>(`/projects/${ctx.projectId}/docs/${docId}/lock`, {
        method: "PATCH",
      });
      process.stdout.write(`Document ${doc.id} locked: ${doc.locked}\n`);
    });
  });

export const docsCommand = new Command("docs")
  .description("Manage project documents")
  .addCommand(listCommand)
  .addCommand(getCommand)
  .addCommand(createCommand)
  .addCommand(updateCommand)
  .addCommand(deleteCommand)
  .addCommand(lockCommand);
