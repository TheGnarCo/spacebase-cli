import { Command } from "commander";
import type { GlobalOpts } from "../cli";
import { getContext } from "../lib/context";
import { output, ColumnDef } from "../lib/output";

export const whoamiCommand = new Command("whoami")
  .description("Display current auth identity and project context")
  .action(function (this: Command) {
    const opts = this.optsWithGlobals<GlobalOpts>();
    const ctx = getContext();
    const displayToken = opts.json
      ? ctx.token
      : ctx.token.slice(0, 3) + "..." + ctx.token.slice(-4);
    const row = {
      token: displayToken,
      baseUrl: ctx.baseUrl,
      projectId: ctx.projectId ?? "(none)",
    };
    const columns: ColumnDef[] = [
      { header: "API Key", key: "token", width: 20 },
      { header: "Base URL", key: "baseUrl", width: 40 },
      { header: "Project", key: "projectId", width: 30 },
    ];
    output.table([row], columns);
  });
