import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { program } from "../cli";
import { output } from "../lib/output";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.SPACEBASE_API_KEY;
  delete process.env.SPACEBASE_URL;
  delete process.env.SPACEBASE_PROJECT_ID;
  delete process.env.XDG_CONFIG_HOME;
  output.configure({ json: false });
});

afterEach(() => {
  process.env = { ...originalEnv };
  mock.restore();
});

describe("logout command", () => {
  it("prints 'Logged out.' and exits 0 when credentials file exists", async () => {
    const dir = join(tmpdir(), "spacebase-logout-test-" + Date.now());
    mkdirSync(join(dir, "spacebase"), { recursive: true });
    writeFileSync(
      join(dir, "spacebase", "credentials.json"),
      JSON.stringify({ apiKey: "sw_testkey", baseUrl: "https://example.com" })
    );
    process.env.XDG_CONFIG_HOME = dir;

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    await program.parseAsync(["node", "spacebase", "logout"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("Logged out.");
    writeSpy.mockRestore();
  });

  it("prints 'No credentials found.' when no credentials file exists", async () => {
    const dir = join(tmpdir(), "spacebase-logout-nofile-" + Date.now());
    process.env.XDG_CONFIG_HOME = dir;

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    await program.parseAsync(["node", "spacebase", "logout"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("No credentials found.");
    writeSpy.mockRestore();
  });

  it("exits 0 when credentials file exists", async () => {
    const dir = join(tmpdir(), "spacebase-logout-exit0-" + Date.now());
    mkdirSync(join(dir, "spacebase"), { recursive: true });
    writeFileSync(
      join(dir, "spacebase", "credentials.json"),
      JSON.stringify({ apiKey: "sw_testkey", baseUrl: "https://example.com" })
    );
    process.env.XDG_CONFIG_HOME = dir;

    // No throw means exit 0 (exitOverride would throw on non-zero exits)
    await program.parseAsync(["node", "spacebase", "logout"]);
  });

  it("exits 0 when no credentials file exists", async () => {
    const dir = join(tmpdir(), "spacebase-logout-exit0-nofile-" + Date.now());
    process.env.XDG_CONFIG_HOME = dir;

    await program.parseAsync(["node", "spacebase", "logout"]);
  });
});
