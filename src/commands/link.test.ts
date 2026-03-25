import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { program } from "../cli";
import { output } from "../lib/output";
import { resetContext } from "../lib/context";

const originalEnv = { ...process.env };

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
});

afterEach(() => {
  resetContext();
  process.env = { ...originalEnv };
  output.configure({ json: false });
  process.chdir(originalCwd);
  mock.restore();
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("link command", () => {
  it("writes .spacebase with project ID argument", async () => {
    process.chdir(testDir);
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    await program.parseAsync(["node", "spacebase", "link", "proj-123"]);

    writeSpy.mockRestore();

    const dotfilePath = join(testDir, ".spacebase");
    expect(existsSync(dotfilePath)).toBe(true);
    expect(readFileSync(dotfilePath, "utf8").trim()).toBe("proj-123");
  });

  it("prints confirmation on success", async () => {
    process.chdir(testDir);
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    await program.parseAsync(["node", "spacebase", "link", "proj-456"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    writeSpy.mockRestore();
    expect(written).toContain("proj-456");
  });

  it("prompts for project ID when not provided", async () => {
    process.chdir(testDir);

    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    const originalStdin = process.stdin;
    const mockStdin = {
      setEncoding: () => {},
      once: (_event: string, cb: (chunk: string) => void) => { cb("prompted-proj\n"); },
      resume: () => {},
    };
    Object.defineProperty(process, "stdin", { value: mockStdin, writable: true });

    try {
      await program.parseAsync(["node", "spacebase", "link"]);

      const dotfilePath = join(testDir, ".spacebase");
      expect(existsSync(dotfilePath)).toBe(true);
      expect(readFileSync(dotfilePath, "utf8").trim()).toBe("prompted-proj");
    } finally {
      Object.defineProperty(process, "stdin", { value: originalStdin, writable: true });
      stdoutSpy.mockRestore();
    }
  });

  it("exits with error on empty prompt input", async () => {
    process.chdir(testDir);

    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true);

    const originalStdin = process.stdin;
    const mockStdin = {
      setEncoding: () => {},
      once: (_event: string, cb: (chunk: string) => void) => { cb("\n"); },
      resume: () => {},
    };
    Object.defineProperty(process, "stdin", { value: mockStdin, writable: true });

    const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    try {
      await program.parseAsync(["node", "spacebase", "link"]);
    } catch {
      // expected
    }

    const written = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("project ID is required");

    Object.defineProperty(process, "stdin", { value: originalStdin, writable: true });
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
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
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "link", "proj-noauth"]);
    writeSpy.mockRestore();
    // Should not throw
  });
});

describe("unlink command", () => {
  it("removes .spacebase file", async () => {
    writeFileSync(join(testDir, ".spacebase"), "some-proj-id\n");
    process.chdir(testDir);

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "unlink"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    writeSpy.mockRestore();

    expect(written).toContain("Unlinked.");
    expect(existsSync(join(testDir, ".spacebase"))).toBe(false);
  });

  it("prints 'Nothing to unlink.' when no .spacebase exists", async () => {
    process.chdir(testDir);

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "unlink"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    writeSpy.mockRestore();

    expect(written).toContain("Nothing to unlink.");
  });

  it("does not delete credentials", async () => {
    // Pre-store credentials
    process.env.XDG_CONFIG_HOME = testDir;
    mkdirSync(join(testDir, "spacebase"), { recursive: true });
    writeFileSync(
      join(testDir, "spacebase", "credentials.json"),
      JSON.stringify({ token: "session_abc", baseUrl: "https://spacebase.thegnar.com" })
    );
    writeFileSync(join(testDir, ".spacebase"), "some-proj\n");
    process.chdir(testDir);

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "unlink"]);
    writeSpy.mockRestore();

    // .spacebase removed but credentials remain
    expect(existsSync(join(testDir, ".spacebase"))).toBe(false);
    expect(existsSync(join(testDir, "spacebase", "credentials.json"))).toBe(true);
  });

  it("is auth-exempt", async () => {
    delete process.env.SPACEBASE_API_KEY;
    process.chdir(testDir);
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "unlink"]);
    writeSpy.mockRestore();
  });
});
