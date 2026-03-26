import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { program } from "../cli";
import { output } from "../lib/output";
import { resetContext } from "../lib/context";
import { credentialsFilePath } from "../lib/auth";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

let originalCwd: string;
let testDir: string;

beforeEach(() => {
  resetContext();
  process.env = { ...originalEnv };
  output.configure({ json: false });
  delete process.env.SPACEBASE_API_KEY;
  delete process.env.SPACEBASE_PROJECT_ID;
  originalCwd = process.cwd();
  testDir = join(tmpdir(), "spacebase-link-test-" + Date.now());
  mkdirSync(testDir, { recursive: true });
  // Point credentials to testDir so we don't touch real config
  process.env.XDG_CONFIG_HOME = testDir;
});

afterEach(() => {
  resetContext();
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
  output.configure({ json: false });
  process.chdir(originalCwd);
  mock.restore();
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

function mockFetchMe(projectId?: string, status = 200) {
  globalThis.fetch = (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({
      type: "api_key",
      project: projectId ? { id: projectId } : undefined,
      user: { id: "u1", username: "test@test.com", display_name: "Test", role: "admin" },
    }),
  })) as unknown as typeof fetch;
}

describe("link command", () => {
  it("validates API key, saves credentials, and writes .spacebase", async () => {
    process.chdir(testDir);
    mockFetchMe("proj-123");
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    await program.parseAsync(["node", "spacebase", "link", "sw_test_key_abc"]);

    writeSpy.mockRestore();

    // .spacebase written with project ID
    const dotfilePath = join(testDir, ".spacebase");
    expect(existsSync(dotfilePath)).toBe(true);
    expect(readFileSync(dotfilePath, "utf8").trim()).toBe("proj-123");

    // credentials saved
    const credsPath = join(testDir, "spacebase", "credentials.json");
    expect(existsSync(credsPath)).toBe(true);
    const creds = JSON.parse(readFileSync(credsPath, "utf8"));
    expect(creds.token).toBe("sw_test_key_abc");
  });

  it("prints confirmation with project ID on success", async () => {
    process.chdir(testDir);
    mockFetchMe("proj-456");
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    await program.parseAsync(["node", "spacebase", "link", "sw_key"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    writeSpy.mockRestore();
    expect(written).toContain("Linked to project proj-456");
  });

  it("handles API key with no associated project", async () => {
    process.chdir(testDir);
    mockFetchMe(undefined);
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    await program.parseAsync(["node", "spacebase", "link", "sw_no_project_key"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    writeSpy.mockRestore();
    expect(written).toContain("Authenticated. No project associated");
    expect(existsSync(join(testDir, ".spacebase"))).toBe(false);
  });

  it("exits with error on invalid API key (401)", async () => {
    process.chdir(testDir);
    mockFetchMe(undefined, 401);

    const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });
    const errorSpy = spyOn(output, "error").mockImplementation(() => {});

    try {
      await program.parseAsync(["node", "spacebase", "link", "bad_key"]);
    } catch {
      // expected
    }

    expect(errorSpy).toHaveBeenCalled();
    const msg = errorSpy.mock.calls[0][0] as string;
    expect(msg).toContain("Authentication failed");
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("shows resolved project context with --status flag", async () => {
    process.chdir(testDir);
    process.env.SPACEBASE_PROJECT_ID = "env-proj-000";

    const spy = spyOn(output, "table");
    await program.parseAsync(["node", "spacebase", "link", "--status"]);

    const calls = spy.mock.calls;
    spy.mockRestore();
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1] as [Array<Record<string, string>>, unknown[]];
    expect(lastCall[0][0].projectId).toBe("env-proj-000");
    expect(lastCall[0][0].source).toBe("env");
  });

  it("--status shows source=flag when --project flag is used", async () => {
    process.chdir(testDir);

    const spy = spyOn(output, "table");
    await program.parseAsync(["node", "spacebase", "--project", "flag-proj-111", "link", "--status"]);

    const calls = spy.mock.calls;
    spy.mockRestore();
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1] as [Array<Record<string, string>>, unknown[]];
    expect(lastCall[0][0].projectId).toBe("flag-proj-111");
    expect(lastCall[0][0].source).toBe("flag");
  });

  it("--status shows source=dotfile when .spacebase file is present", async () => {
    writeFileSync(join(testDir, ".spacebase"), "dotfile-proj-222\n");
    process.chdir(testDir);

    const spy = spyOn(output, "table");
    await program.parseAsync(["node", "spacebase", "link", "--status"]);

    const calls = spy.mock.calls;
    spy.mockRestore();
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1] as [Array<Record<string, string>>, unknown[]];
    expect(lastCall[0][0].projectId).toBe("dotfile-proj-222");
    expect(lastCall[0][0].source).toBe("dotfile");
  });

  it("is auth-exempt", async () => {
    delete process.env.SPACEBASE_API_KEY;
    process.chdir(testDir);
    mockFetchMe("proj-noauth");
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "link", "sw_exempt_key"]);
    writeSpy.mockRestore();
    // Should not throw due to missing credentials
  });
});

describe("unlink command", () => {
  it("removes .spacebase file and credentials", async () => {
    // Set up dotfile
    writeFileSync(join(testDir, ".spacebase"), "some-proj-id\n");
    // Set up credentials
    mkdirSync(join(testDir, "spacebase"), { recursive: true });
    writeFileSync(
      join(testDir, "spacebase", "credentials.json"),
      JSON.stringify({ token: "sw_key", baseUrl: "https://spacebase.thegnar.com" })
    );
    process.chdir(testDir);

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "unlink"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    writeSpy.mockRestore();

    expect(written).toContain("Unlinked.");
    expect(existsSync(join(testDir, ".spacebase"))).toBe(false);
    expect(existsSync(join(testDir, "spacebase", "credentials.json"))).toBe(false);
  });

  it("prints 'Nothing to unlink.' when nothing exists", async () => {
    process.chdir(testDir);

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "unlink"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    writeSpy.mockRestore();

    expect(written).toContain("Nothing to unlink.");
  });

  it("is auth-exempt", async () => {
    delete process.env.SPACEBASE_API_KEY;
    process.chdir(testDir);
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "unlink"]);
    writeSpy.mockRestore();
  });
});
