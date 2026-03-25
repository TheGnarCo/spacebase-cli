import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { program } from "../cli";
import { output } from "../lib/output";
import { resetContext } from "../lib/context";

const TEST_API_KEY = "sw_testkey1234";
const originalEnv = { ...process.env };

let originalCwd: string;
let testDir: string;

beforeEach(() => {
  resetContext();
  process.env = { ...originalEnv };
  output.configure({ json: false });
  process.env.SPACEBASE_API_KEY = TEST_API_KEY;
  delete process.env.SPACEBASE_PROJECT_ID;
  originalCwd = process.cwd();
  testDir = join(tmpdir(), "spacebase-link-test-" + Date.now());
  mkdirSync(testDir, { recursive: true });
  process.env.XDG_CONFIG_HOME = testDir;
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

const mockMeResponse = {
  user: { email: "user@example.com" },
  project: { id: "proj-uuid-123", name: "My Project" },
};

describe("link command", () => {
  it("verifies API key, saves credentials, and writes .spacebase", async () => {
    const tmpDir = join(tmpdir(), "spacebase-link-full-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockMeResponse), { status: 200 })
    );
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    await program.parseAsync(["node", "spacebase", "--api-key", "sw_valid_key", "link"]);

    writeSpy.mockRestore();
    mockFetch.mockRestore();

    // .spacebase written with project ID from API
    const dotfilePath = join(tmpDir, ".spacebase");
    expect(existsSync(dotfilePath)).toBe(true);
    expect(readFileSync(dotfilePath, "utf8").trim()).toBe("proj-uuid-123");

    // Credentials saved
    const credsPath = join(testDir, "spacebase", "credentials.json");
    const saved = JSON.parse(readFileSync(credsPath, "utf8"));
    expect(saved.apiKey).toBe("sw_valid_key");
  });

  it("uses --project flag to override auto-detected project ID", async () => {
    const tmpDir = join(tmpdir(), "spacebase-link-override-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockMeResponse), { status: 200 })
    );
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    await program.parseAsync(["node", "spacebase", "--api-key", "sw_valid_key", "--project", "custom-proj", "link"]);

    writeSpy.mockRestore();
    mockFetch.mockRestore();

    expect(readFileSync(join(tmpDir, ".spacebase"), "utf8").trim()).toBe("custom-proj");
  });

  it("prints project info on success", async () => {
    const tmpDir = join(tmpdir(), "spacebase-link-info-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockMeResponse), { status: 200 })
    );
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    await program.parseAsync(["node", "spacebase", "--api-key", "sw_valid_key", "link"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("My Project");
    expect(written).toContain("proj-uuid-123");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("prints error and exits on invalid API key", async () => {
    const tmpDir = join(tmpdir(), "spacebase-link-401-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        statusText: "Unauthorized",
      })
    );
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true);
    const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    try {
      await program.parseAsync(["node", "spacebase", "--api-key", "sw_bad_key", "link"]);
    } catch {
      // expected
    }

    const written = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("authentication failed");

    stderrSpy.mockRestore();
    exitSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("prompts for API key when not provided and exits on empty input", async () => {
    delete process.env.SPACEBASE_API_KEY;
    const tmpDir = join(tmpdir(), "spacebase-link-prompt-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true);

    const originalStdin = process.stdin;
    const mockStdin = {
      setEncoding: () => {},
      once: (_event: string, cb: (chunk: string) => void) => { cb("\n"); },
      resume: () => {},
    };
    Object.defineProperty(process, "stdin", { value: mockStdin, writable: true });

    let exitCode: number | undefined;
    const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    });

    try {
      await program.parseAsync(["node", "spacebase", "link"]);
    } catch {
      // expected
    }

    expect(exitCode).toBe(1);
    const prompted = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(prompted).toContain("API key");

    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
    Object.defineProperty(process, "stdin", { value: originalStdin, writable: true });
  });

  it("uses stored credentials when no --api-key flag", async () => {
    delete process.env.SPACEBASE_API_KEY;
    const tmpDir = join(tmpdir(), "spacebase-link-stored-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    // Pre-store credentials
    mkdirSync(join(testDir, "spacebase"), { recursive: true });
    writeFileSync(
      join(testDir, "spacebase", "credentials.json"),
      JSON.stringify({ apiKey: "sw_stored_key", baseUrl: "https://spacebase.thegnar.com" })
    );

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockMeResponse), { status: 200 })
    );
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    await program.parseAsync(["node", "spacebase", "link"]);

    writeSpy.mockRestore();
    mockFetch.mockRestore();

    expect(existsSync(join(tmpDir, ".spacebase"))).toBe(true);
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
  it("removes .spacebase file and credentials", async () => {
    const tmpDir = join(tmpdir(), "spacebase-unlink-full-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, ".spacebase"), "some-proj-id\n");
    process.chdir(tmpDir);

    mkdirSync(join(testDir, "spacebase"), { recursive: true });
    writeFileSync(
      join(testDir, "spacebase", "credentials.json"),
      JSON.stringify({ apiKey: "sw_testkey", baseUrl: "https://example.com" })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "unlink"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    writeSpy.mockRestore();

    expect(written).toContain("Unlinked.");
    expect(existsSync(join(tmpDir, ".spacebase"))).toBe(false);
    expect(existsSync(join(testDir, "spacebase", "credentials.json"))).toBe(false);
  });

  it("prints 'Nothing to unlink.' when nothing exists", async () => {
    const tmpDir = join(tmpdir(), "spacebase-unlink-empty-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "unlink"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    writeSpy.mockRestore();

    expect(written).toContain("Nothing to unlink.");
  });

  it("does not require auth", async () => {
    delete process.env.SPACEBASE_API_KEY;
    const tmpDir = join(tmpdir(), "spacebase-unlink-noauth-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "unlink"]);
    writeSpy.mockRestore();
  });
});
