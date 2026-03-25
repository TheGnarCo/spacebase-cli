import { Command } from "commander";
import { readFile, writeFile, readdir, mkdir } from "fs/promises";
import { join, resolve } from "path";
import { createHash } from "crypto";
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

interface ManifestEntry {
  docId: string;
  title: string;
  checksum: string;
}

type Manifest = Record<string, ManifestEntry>;

const MANIFEST_FILE = ".spacebase-manifest.json";

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
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

const pullCommand = new Command("pull")
  .description("Pull all documents to a local directory")
  .argument("[dir]", "Target directory", "docs")
  .action(async function (this: Command, dir: string) {
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);

      const targetDir = resolve(dir);
      await mkdir(targetDir, { recursive: true });

      const docs = await apiFetchJson<Doc[]>(`/projects/${ctx.projectId}/docs`);

      const manifest: Manifest = {};
      let pulled = 0;
      let failed = 0;

      for (const doc of docs) {
        try {
          const response = await apiFetch(`/projects/${ctx.projectId}/docs/${doc.id}/raw`);
          const content = await response.text();
          const filename = `${doc.title}.md`;
          await writeFile(join(targetDir, filename), content);
          manifest[filename] = {
            docId: doc.id,
            title: doc.title,
            checksum: sha256(content),
          };
          pulled++;
        } catch {
          output.error(`Failed to pull "${doc.title}" (${doc.id})`);
          failed++;
        }
      }

      await writeFile(join(targetDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2));
      process.stdout.write(`Pulled ${pulled} doc(s)${failed > 0 ? `, ${failed} failed` : ""}\n`);
    });
  });

const pushCommand = new Command("push")
  .description("Push local documents to the API")
  .argument("[dir]", "Source directory", "docs")
  .action(async function (this: Command, dir: string) {
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);

      const sourceDir = resolve(dir);
      const manifestPath = join(sourceDir, MANIFEST_FILE);

      let manifest: Manifest;
      try {
        const raw = await readFile(manifestPath, "utf8");
        manifest = JSON.parse(raw);
      } catch {
        output.error(`No manifest found at ${manifestPath}. Run "docs pull" first.`);
        process.exit(1);
        return;
      }

      const files = await readdir(sourceDir);
      const mdFiles = files.filter((f) => f.endsWith(".md"));

      let created = 0;
      let updated = 0;
      const deleted: string[] = [];

      for (const filename of mdFiles) {
        const content = await readFile(join(sourceDir, filename), "utf8");
        const checksum = sha256(content);
        const entry = manifest[filename];

        if (!entry) {
          // New file — create
          const title = filename.replace(/\.md$/, "");
          const doc = await apiFetchJson<Doc>(`/projects/${ctx.projectId}/docs`, {
            method: "POST",
            body: JSON.stringify({ title, content }),
          });
          manifest[filename] = { docId: doc.id, title, checksum };
          created++;
        } else if (entry.checksum !== checksum) {
          // Modified — update
          await apiFetchJson<Doc>(`/projects/${ctx.projectId}/docs/${entry.docId}`, {
            method: "PUT",
            body: JSON.stringify({ content }),
          });
          manifest[filename] = { ...entry, checksum };
          updated++;
        }
      }

      // Check for deleted files (in manifest but not on disk)
      for (const filename of Object.keys(manifest)) {
        if (!mdFiles.includes(filename)) {
          deleted.push(filename);
        }
      }

      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      const parts: string[] = [];
      if (created > 0) parts.push(`${created} created`);
      if (updated > 0) parts.push(`${updated} updated`);
      if (deleted.length > 0) {
        parts.push(`${deleted.length} deleted locally (not removed from API)`);
        for (const f of deleted) {
          process.stdout.write(`  Deleted locally: ${f}\n`);
        }
      }
      process.stdout.write(`Push: ${parts.length > 0 ? parts.join(", ") : "no changes"}\n`);
    });
  });

export const docsCommand = new Command("docs")
  .description("Manage project documents")
  .addCommand(listCommand)
  .addCommand(getCommand)
  .addCommand(createCommand)
  .addCommand(updateCommand)
  .addCommand(deleteCommand)
  .addCommand(lockCommand)
  .addCommand(pullCommand)
  .addCommand(pushCommand);
