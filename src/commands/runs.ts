import { Command } from "commander";
import { mkdir, readFile, writeFile } from "fs/promises";
import { basename, extname, join } from "path";
import type { GlobalOpts } from "../cli";
import { getContext } from "../lib/context";
import { requireProjectId, wrapAction } from "../lib/errors";
import { apiFetch, apiFetchFormData, apiFetchJson } from "../lib/http";
import { output, ColumnDef } from "../lib/output";

interface Run {
  id: string;
  status: string;
  created_at: string;
}

interface RunArtifact {
  id: string;
  filename: string;
  size: number;
  created_at: string;
  download_url?: string;
}

const triggerCommand = new Command("trigger")
  .description("Trigger a new Ideate pipeline run")
  .action(async function (this: Command) {
    const opts = this.optsWithGlobals<GlobalOpts>();
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);
      const run = await apiFetchJson<Run>(`/projects/${ctx.projectId}/runs`, {
        method: "POST",
      });
      if (opts.json) {
        output.json(run);
      } else {
        process.stdout.write(`Triggered run ${run.id}\n`);
      }
    });
  });

const statusCommand = new Command("status")
  .description("Get the status of a run")
  .argument("<runId>", "Run ID")
  .action(async function (this: Command, runId: string) {
    const opts = this.optsWithGlobals<GlobalOpts>();
    const run = await apiFetchJson<Run>(`/runs/${runId}`);
    if (opts.json) {
      output.json(run);
    } else {
      const columns: ColumnDef[] = [
        { header: "ID", key: "id", width: 30 },
        { header: "Status", key: "status", width: 20 },
        { header: "Created At", key: "created_at", width: 30 },
      ];
      output.table([run], columns);
    }
  });

const artifactsCommand = new Command("artifacts")
  .description("List artifacts for a run; optionally download with --out")
  .argument("<runId>", "Run ID")
  .option("--out <dir>", "Download artifacts to this directory")
  .action(async function (this: Command, runId: string) {
    const opts = this.optsWithGlobals<GlobalOpts & { out?: string }>();
    const artifacts = await apiFetchJson<RunArtifact[]>(`/runs/${runId}/artifacts`);

    if (opts.out) {
      await mkdir(opts.out, { recursive: true });
      for (const artifact of artifacts) {
        const downloadPath = artifact.download_url ?? `/runs/${runId}/artifacts/${artifact.id}/download`;
        const response = await apiFetch(downloadPath);
        const buffer = await response.arrayBuffer();
        await writeFile(join(opts.out, artifact.filename), Buffer.from(buffer));
      }
      process.stdout.write(`Downloaded ${artifacts.length} artifact(s) to ${opts.out}\n`);
    } else {
      const columns: ColumnDef[] = [
        { header: "ID", key: "id", width: 20 },
        { header: "Filename", key: "filename", width: 40 },
        { header: "Size", key: "size", width: 12 },
        { header: "Created At", key: "created_at", width: 30 },
      ];
      output.table(artifacts, columns);
    }
  });

export function inferArtifactType(filename: string): string {
  const name = basename(filename).toLowerCase();
  if (name.includes("prd")) return "prd";
  if (name.includes("architecture")) return "architecture";
  if (name.includes("staffing") || name.includes("team")) return "staffing_plan";
  if (name.includes("project") || name.includes("plan")) return "project_plan";
  return "other";
}

export function inferTitle(filename: string): string {
  const base = basename(filename, extname(filename));
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const claimCommand = new Command("claim")
  .description("Claim a run for processing")
  .argument("<runId>", "Run ID")
  .action(async function (this: Command, runId: string) {
    const opts = this.optsWithGlobals<GlobalOpts>();
    const run = await apiFetchJson<Run>(`/runs/${runId}/claim`, { method: "POST" });
    if (opts.json) {
      output.json(run);
    } else {
      const columns: ColumnDef[] = [
        { header: "ID", key: "id", width: 30 },
        { header: "Status", key: "status", width: 20 },
        { header: "Created At", key: "created_at", width: 30 },
      ];
      output.table([run], columns);
    }
  });

const sourcesCommand = new Command("sources")
  .description("List source artifacts for a run; optionally download with --out")
  .argument("<runId>", "Run ID")
  .option("--out <dir>", "Download sources to this directory")
  .action(async function (this: Command, runId: string) {
    const opts = this.optsWithGlobals<GlobalOpts & { out?: string }>();
    const sources = await apiFetchJson<RunArtifact[]>(`/runs/${runId}/sources`);

    if (opts.out) {
      await mkdir(opts.out, { recursive: true });
      for (const source of sources) {
        const downloadPath = source.download_url ?? `/runs/${runId}/sources/${source.id}/download`;
        const response = await apiFetch(downloadPath);
        const buffer = await response.arrayBuffer();
        await writeFile(join(opts.out, source.filename), Buffer.from(buffer));
      }
      process.stdout.write(`Downloaded ${sources.length} source(s) to ${opts.out}\n`);
    } else if (opts.json) {
      output.json(sources);
    } else {
      const columns: ColumnDef[] = [
        { header: "ID", key: "id", width: 20 },
        { header: "Filename", key: "filename", width: 40 },
        { header: "Size", key: "size", width: 12 },
        { header: "Created At", key: "created_at", width: 30 },
      ];
      output.table(sources, columns);
    }
  });

const uploadCommand = new Command("upload")
  .description("Upload an artifact for a run")
  .argument("<runId>", "Run ID")
  .argument("<file>", "Path to file to upload")
  .option("--type <type>", "Artifact type (inferred from filename if omitted)")
  .option("--title <title>", "Artifact title (inferred from filename if omitted)")
  .action(async function (this: Command, runId: string, file: string) {
    const opts = this.optsWithGlobals<GlobalOpts & { type?: string; title?: string }>();
    const fileContent = await readFile(file);
    const form = new FormData();
    form.append("file", new Blob([fileContent]), basename(file));
    form.append("type", opts.type ?? inferArtifactType(file));
    form.append("title", opts.title ?? inferTitle(file));

    const artifact = await apiFetchFormData<RunArtifact>(`/runs/${runId}/artifacts`, form);
    if (opts.json) {
      output.json(artifact);
    } else {
      process.stdout.write(`Uploaded artifact ${artifact.id}\n`);
    }
  });

const updateCommand = new Command("update")
  .description("Update the status of a run")
  .argument("<runId>", "Run ID")
  .requiredOption("--status <status>", "New status")
  .option("--error <msg>", "Error message (for failed status)")
  .action(async function (this: Command, runId: string) {
    const opts = this.optsWithGlobals<GlobalOpts & { status: string; error?: string }>();
    const body: Record<string, string> = { status: opts.status };
    if (opts.error) body.error = opts.error;

    const run = await apiFetchJson<Run>(`/runs/${runId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (opts.json) {
      output.json(run);
    } else {
      process.stdout.write(`Updated run ${run.id} status to ${run.status}\n`);
    }
  });

export const runsCommand = new Command("runs")
  .description("Manage Ideate pipeline runs")
  .addCommand(triggerCommand)
  .addCommand(statusCommand)
  .addCommand(artifactsCommand)
  .addCommand(claimCommand)
  .addCommand(sourcesCommand)
  .addCommand(uploadCommand)
  .addCommand(updateCommand);
