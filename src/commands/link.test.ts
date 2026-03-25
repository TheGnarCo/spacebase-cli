import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { program } from "../cli";
import { output } from "../lib/output";
import { resetContext } from "../lib/context";

const TEST_API_KEY = "sw_testkey1234";

let originalCwd: string;

beforeEach(() => {
  resetContext();
  output.configure({ json: false });
  process.env.SPACEBASE_API_KEY = TEST_API_KEY;
  delete process.env.SPACEBASE_PROJECT_ID;
  originalCwd = process.cwd();
});

afterEach(() => {
  resetContext();
  output.configure({ json: false });
  delete process.env.SPACEBASE_API_KEY;
  delete process.env.SPACEBASE_PROJECT_ID;
  process.chdir(originalCwd);
});

describe("link command", () => {
  it("writes .spacebase file with project ID from --project flag", async () => {
    const tmpDir = join(tmpdir(), "spacebase-link-test-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "--project", "proj-abc-123", "link"]);
    writeSpy.mockRestore();

    const dotfilePath = join(tmpDir, ".spacebase");
    expect(existsSync(dotfilePath)).toBe(true);
    expect(readFileSync(dotfilePath, "utf8").trim()).toBe("proj-abc-123");
  });

  it("auto-detects project ID from API when no --project flag", async () => {
    const tmpDir = join(tmpdir(), "spacebase-link-autodetect-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({
          user: { email: "user@example.com" },
          project: { id: "auto-proj-456", name: "My Project" },
        }),
        { status: 200 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "link"]);
    writeSpy.mockRestore();
    mockFetch.mockRestore();

    const dotfilePath = join(tmpDir, ".spacebase");
    expect(existsSync(dotfilePath)).toBe(true);
    expect(readFileSync(dotfilePath, "utf8").trim()).toBe("auto-proj-456");
  });

  it("prints confirmation after writing .spacebase", async () => {
    const tmpDir = join(tmpdir(), "spacebase-link-confirm-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "--project", "proj-confirm-789", "link"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    writeSpy.mockRestore();

    expect(written).toContain("Linked to project proj-confirm-789");
  });

  it("shows resolved project context with --status flag", async () => {
    const tmpDir = join(tmpdir(), "spacebase-link-status-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

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
    const tmpDir = join(tmpdir(), "spacebase-link-status-flag-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

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
    const tmpDir = join(tmpdir(), "spacebase-link-status-dotfile-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, ".spacebase"), "dotfile-proj-222\n");
    process.chdir(tmpDir);

    const spy = spyOn(output, "table");
    await program.parseAsync(["node", "spacebase", "link", "--status"]);

    const calls = spy.mock.calls;
    spy.mockRestore();
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1] as [Array<Record<string, string>>, unknown[]];
    expect(lastCall[0][0].projectId).toBe("dotfile-proj-222");
    expect(lastCall[0][0].source).toBe("dotfile");
  });
});

describe("unlink command", () => {
  it("removes .spacebase file when it exists", async () => {
    const tmpDir = join(tmpdir(), "spacebase-unlink-test-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, ".spacebase"), "some-proj-id\n");
    process.chdir(tmpDir);

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "unlink"]);
    writeSpy.mockRestore();

    expect(existsSync(join(tmpDir, ".spacebase"))).toBe(false);
  });

  it("prints 'Unlinked.' when .spacebase file existed", async () => {
    const tmpDir = join(tmpdir(), "spacebase-unlink-msg-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, ".spacebase"), "some-proj-id\n");
    process.chdir(tmpDir);

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "unlink"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    writeSpy.mockRestore();

    expect(written).toContain("Unlinked.");
  });

  it("handles missing .spacebase gracefully and exits 0", async () => {
    const tmpDir = join(tmpdir(), "spacebase-unlink-nofile-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    // Should not throw
    await program.parseAsync(["node", "spacebase", "unlink"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    writeSpy.mockRestore();

    expect(written).toContain("No .spacebase file found.");
  });

  it("does not require auth (works without SPACEBASE_API_KEY)", async () => {
    delete process.env.SPACEBASE_API_KEY;
    const tmpDir = join(tmpdir(), "spacebase-unlink-noauth-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    // Should not throw even without auth
    await program.parseAsync(["node", "spacebase", "unlink"]);
    writeSpy.mockRestore();
  });
});
