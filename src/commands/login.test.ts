import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { mkdirSync, readFileSync, rmSync } from "fs";
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
  delete process.env.SPACEBASE_PROJECT_ID;
  testDir = join(tmpdir(), "spacebase-login-test-" + Date.now());
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

const mockAuthResponse = { token: "session_abc123" };
const mockMeResponse = {
  type: "session",
  user: { id: "u1", username: "admin", display_name: "Admin User", role: "admin" },
};

describe("login command", () => {
  it("authenticates and saves credentials", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/v1/auth")) {
        return new Response(JSON.stringify(mockAuthResponse), { status: 200 });
      }
      if (url.endsWith("/api/v1/me")) {
        return new Response(JSON.stringify(mockMeResponse), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });

    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    // Mock stdin to provide username and password
    const originalStdin = process.stdin;
    let callCount = 0;
    const mockStdin = {
      setEncoding: () => {},
      once: (_event: string, cb: (chunk: string) => void) => {
        callCount++;
        // First call is username, then password prompt uses .on()
        cb("admin\n");
      },
      on: (_event: string, cb: (chunk: string) => void) => {
        cb("secret\r");
      },
      removeListener: () => {},
      resume: () => {},
      pause: () => {},
      setRawMode: () => {},
    };
    Object.defineProperty(process, "stdin", { value: mockStdin, writable: true });
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      await program.parseAsync(["node", "spacebase", "login"]);

      const written = stdoutSpy.mock.calls.map((c) => c[0]).join("");
      expect(written).toContain("Admin User");

      // Credentials saved
      const credsPath = join(testDir, "spacebase", "credentials.json");
      const saved = JSON.parse(readFileSync(credsPath, "utf8"));
      expect(saved.token).toBe("session_abc123");
    } finally {
      Object.defineProperty(process, "stdin", { value: originalStdin, writable: true });
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
      mockFetch.mockRestore();
    }
  });

  it("prints error on auth failure", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, statusText: "Unauthorized" })
    );

    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true);
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    // Mock stdin
    const originalStdin = process.stdin;
    const mockStdin = {
      setEncoding: () => {},
      once: (_event: string, cb: (chunk: string) => void) => { cb("admin\n"); },
      on: (_event: string, cb: (chunk: string) => void) => { cb("badpass\r"); },
      removeListener: () => {},
      resume: () => {},
      pause: () => {},
      setRawMode: () => {},
    };
    Object.defineProperty(process, "stdin", { value: mockStdin, writable: true });

    try {
      await program.parseAsync(["node", "spacebase", "login"]);
    } catch {
      // expected
    }

    const written = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("authentication failed");

    Object.defineProperty(process, "stdin", { value: originalStdin, writable: true });
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
    exitSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("accepts --username flag", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/v1/auth")) {
        const body = JSON.parse(init?.body as string);
        expect(body.username).toBe("flaguser");
        return new Response(JSON.stringify(mockAuthResponse), { status: 200 });
      }
      if (url.endsWith("/api/v1/me")) {
        return new Response(JSON.stringify(mockMeResponse), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });

    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true);

    // Only need password prompt when username is provided via flag
    const originalStdin = process.stdin;
    const mockStdin = {
      setEncoding: () => {},
      once: () => {},
      on: (_event: string, cb: (chunk: string) => void) => { cb("secret\r"); },
      removeListener: () => {},
      resume: () => {},
      pause: () => {},
      setRawMode: () => {},
    };
    Object.defineProperty(process, "stdin", { value: mockStdin, writable: true });

    try {
      await program.parseAsync(["node", "spacebase", "login", "--username", "flaguser"]);
    } finally {
      Object.defineProperty(process, "stdin", { value: originalStdin, writable: true });
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
      mockFetch.mockRestore();
    }
  });

  it("is auth-exempt (does not require existing credentials)", async () => {
    delete process.env.SPACEBASE_API_KEY;

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/v1/auth")) {
        return new Response(JSON.stringify(mockAuthResponse), { status: 200 });
      }
      if (url.endsWith("/api/v1/me")) {
        return new Response(JSON.stringify(mockMeResponse), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });

    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true);

    const originalStdin = process.stdin;
    const mockStdin = {
      setEncoding: () => {},
      once: (_event: string, cb: (chunk: string) => void) => { cb("admin\n"); },
      on: (_event: string, cb: (chunk: string) => void) => { cb("secret\r"); },
      removeListener: () => {},
      resume: () => {},
      pause: () => {},
      setRawMode: () => {},
    };
    Object.defineProperty(process, "stdin", { value: mockStdin, writable: true });

    try {
      await program.parseAsync(["node", "spacebase", "login"]);
      // Should not throw — login is auth-exempt
    } finally {
      Object.defineProperty(process, "stdin", { value: originalStdin, writable: true });
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
      mockFetch.mockRestore();
    }
  });
});
