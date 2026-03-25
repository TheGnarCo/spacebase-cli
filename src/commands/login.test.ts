import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { join } from "path";
import { tmpdir } from "os";
import { rmSync } from "fs";
import { program } from "../cli";
import { output } from "../lib/output";

const originalEnv = { ...process.env };

let testDir: string;

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.SPACEBASE_API_KEY;
  delete process.env.SPACEBASE_URL;
  delete process.env.SPACEBASE_PROJECT_ID;
  testDir = join(tmpdir(), "spacebase-login-test-" + Date.now());
  process.env.XDG_CONFIG_HOME = testDir;
  output.configure({ json: false });
});

afterEach(() => {
  process.env = { ...originalEnv };
  mock.restore();
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

const mockMeResponse = {
  user: { email: "user@example.com" },
  project: { id: "proj-uuid-123", name: "My Project" },
};

describe("login command", () => {
  it("succeeds with valid API key and saves credentials", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(mockMeResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    await program.parseAsync(["node", "spacebase", "--api-key", "sw_valid_key", "login"]);

    writeSpy.mockRestore();

    // Verify credentials were saved
    const { readFileSync } = await import("fs");
    const filePath = join(testDir, "spacebase", "credentials.json");
    const saved = JSON.parse(readFileSync(filePath, "utf8"));
    expect(saved.apiKey).toBe("sw_valid_key");
    expect(saved.baseUrl).toBe("https://spacebase.thegnar.com");
  });

  it("prints project info on success", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(mockMeResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    await program.parseAsync(["node", "spacebase", "--api-key", "sw_valid_key", "login"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("My Project");
    expect(written).toContain("proj-uuid-123");
    writeSpy.mockRestore();
  });

  it("prints error and exits non-zero on 401", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        statusText: "Unauthorized",
        headers: { "Content-Type": "application/json" },
      });

    const writeSpy = spyOn(process.stderr, "write").mockImplementation(() => true);

    let exitCode: number | undefined;
    const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    });

    try {
      await program.parseAsync(["node", "spacebase", "--api-key", "sw_bad_key", "login"]);
    } catch {
      // expected — process.exit throws in our mock
    }

    expect(exitCode).toBe(1);
    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(written.length).toBeGreaterThan(0);

    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("prompts for API key when --api-key not provided and exits on empty input", async () => {
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true);

    // Simulate stdin returning empty string
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
      await program.parseAsync(["node", "spacebase", "login"]);
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
});
