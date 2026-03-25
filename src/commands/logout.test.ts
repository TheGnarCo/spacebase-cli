import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { program } from "../cli";
import { resetContext } from "../lib/context";
import { output } from "../lib/output";

const originalEnv = { ...process.env };
let testDir: string;

beforeEach(() => {
  resetContext();
  process.env = { ...originalEnv };
  output.configure({ json: false });
  delete process.env.SPACEBASE_API_KEY;
  testDir = join(tmpdir(), "spacebase-logout-test-" + Date.now());
  mkdirSync(testDir, { recursive: true });
  process.env.XDG_CONFIG_HOME = testDir;
});

afterEach(() => {
  resetContext();
  process.env = { ...originalEnv };
  output.configure({ json: false });
  mock.restore();
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("logout command", () => {
  it("deletes credentials and prints confirmation", async () => {
    // Pre-store credentials
    mkdirSync(join(testDir, "spacebase"), { recursive: true });
    writeFileSync(
      join(testDir, "spacebase", "credentials.json"),
      JSON.stringify({ token: "session_abc", baseUrl: "https://spacebase.thegnar.com" })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "logout"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    writeSpy.mockRestore();

    expect(written).toContain("Logged out.");
    expect(existsSync(join(testDir, "spacebase", "credentials.json"))).toBe(false);
  });

  it("prints 'Not logged in.' when no credentials exist", async () => {
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "logout"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    writeSpy.mockRestore();

    expect(written).toContain("Not logged in.");
  });

  it("is auth-exempt", async () => {
    delete process.env.SPACEBASE_API_KEY;
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "logout"]);
    writeSpy.mockRestore();
    // Should not throw — logout is auth-exempt
  });
});
