import { Command } from "commander";
import { getContext } from "../lib/context";
import { requireProjectId, wrapAction } from "../lib/errors";
import { apiFetch, apiFetchJson } from "../lib/http";
import { output, ColumnDef } from "../lib/output";

interface Key {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
}

interface CreatedKey extends Key {
  key: string;
}

const listCommand = new Command("list")
  .description("List API keys for a project")
  .action(async function () {
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);
      const keys = await apiFetchJson<Key[]>(`/projects/${ctx.projectId}/keys`);
      const columns: ColumnDef[] = [
        { header: "ID", key: "id", width: 20 },
        { header: "Name", key: "name", width: 30 },
        { header: "Prefix", key: "prefix", width: 15 },
        { header: "Created At", key: "created_at", width: 25 },
      ];
      output.table(keys, columns);
    });
  });

const createCommand = new Command("create")
  .description("Create a new API key")
  .argument("<name>", "Key name")
  .action(async function (_name: string) {
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);
      const created = await apiFetchJson<CreatedKey>(`/projects/${ctx.projectId}/keys`, {
        method: "POST",
        body: JSON.stringify({ name: _name }),
      });
      process.stdout.write(`Created key ${created.id}: ${created.key}\n`);
    });
  });

const revokeCommand = new Command("revoke")
  .description("Revoke an API key")
  .argument("<keyId>", "Key ID to revoke")
  .action(async function (keyId: string) {
    await wrapAction(async () => {
      const ctx = getContext();
      requireProjectId(ctx.projectId);
      await apiFetch(`/projects/${ctx.projectId}/keys/${keyId}`, { method: "DELETE" });
      process.stdout.write(`Revoked key ${keyId}\n`);
    });
  });

export const keysCommand = new Command("keys")
  .description("Manage project API keys")
  .addCommand(listCommand)
  .addCommand(createCommand)
  .addCommand(revokeCommand);
