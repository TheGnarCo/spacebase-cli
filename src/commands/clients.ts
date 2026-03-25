import { Command } from "commander";
import type { GlobalOpts } from "../cli";
import { apiFetchJson } from "../lib/http";
import { output, ColumnDef } from "../lib/output";

interface Client {
  id: string;
  name: string;
  created_at: string;
}

const listCommand = new Command("list")
  .description("List all clients")
  .action(async function () {
    const clients = await apiFetchJson<Client[]>("/clients");
    const columns: ColumnDef[] = [
      { header: "ID", key: "id", width: 20 },
      { header: "Name", key: "name", width: 30 },
      { header: "Created At", key: "created_at", width: 25 },
    ];
    output.table(clients, columns);
  });

const getCommand = new Command("get")
  .description("Get a client by ID")
  .argument("<clientId>", "Client ID")
  .action(async function (this: Command, clientId: string) {
    const opts = this.optsWithGlobals<GlobalOpts>();
    const client = await apiFetchJson<Client>(`/clients/${clientId}`);
    if (opts.json) {
      output.json(client);
      return;
    }
    const columns: ColumnDef[] = [
      { header: "ID", key: "id", width: 20 },
      { header: "Name", key: "name", width: 30 },
      { header: "Created At", key: "created_at", width: 25 },
    ];
    output.table([client], columns);
  });

export const clientsCommand = new Command("clients")
  .description("Manage clients")
  .addCommand(listCommand)
  .addCommand(getCommand);
