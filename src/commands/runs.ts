import { Command } from "commander";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { GlobalOpts } from "../cli";
import { getContext } from "../lib/context";
import { requireProjectId, wrapAction } from "../lib/errors";
import { apiFetch, apiFetchJson } from "../lib/http";
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

export const runsCommand = new Command("runs")
  .description("Manage Ideate pipeline runs")
  .addCommand(triggerCommand)
  .addCommand(statusCommand)
  .addCommand(artifactsCommand);
