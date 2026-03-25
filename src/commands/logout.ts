import { Command } from "commander";
import { deleteCredentials } from "../lib/auth";

export const logoutCommand = new Command("logout")
  .description("Remove stored credentials")
  .action(async function () {
    const deleted = await deleteCredentials();
    if (deleted) {
      process.stdout.write("Logged out.\n");
    } else {
      process.stdout.write("No credentials found.\n");
    }
  });
