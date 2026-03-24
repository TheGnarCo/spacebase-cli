import { Command } from "commander";
import type { GlobalOpts } from "../cli";
import { getContext } from "../lib/context";
import { output, ColumnDef } from "../lib/output";

export const whoamiCommand = new Command("whoami")
  .description("Display current auth identity and project context")
  .action(function (this: Command) {
    const opts = this.optsWithGlobals<GlobalOpts>();
    const ctx = getContext();
    const displayKey = opts.json
      ? ctx.apiKey
      : ctx.apiKey.slice(0, 3) + "..." + ctx.apiKey.slice(-4);
    const row = {
      apiKey: displayKey,
      baseUrl: ctx.baseUrl,
      projectId: ctx.projectId ?? "(none)",
    };
    const columns: ColumnDef[] = [
      { header: "API Key", key: "apiKey", width: 20 },
      { header: "Base URL", key: "baseUrl", width: 40 },
      { header: "Project", key: "projectId", width: 30 },
    ];
    output.table([row], columns);
  });
