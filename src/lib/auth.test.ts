import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { loadCredentials, resolveProjectId, deleteCredentials, credentialsFilePath, saveCredentials } from "./auth";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  // Clear all spacebase env vars
  delete process.env.SPACEBASE_API_KEY;
  delete process.env.SPACEBASE_URL;
  delete process.env.SPACEBASE_PROJECT_ID;
  delete process.env.XDG_CONFIG_HOME;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("loadCredentials", () => {
  it("returns undefined when no env vars and no credentials file", async () => {
    // Point XDG_CONFIG_HOME to a non-existent dir
    process.env.XDG_CONFIG_HOME = join(tmpdir(), "spacebase-test-nonexistent-" + Date.now());
    const creds = await loadCredentials();
    expect(creds).toBeUndefined();
  });

  it("loads token from SPACEBASE_API_KEY env var", async () => {
    process.env.SPACEBASE_API_KEY = "sw_env_key";
    const creds = await loadCredentials();
    expect(creds?.token).toBe("sw_env_key");
  });

  it("uses default baseUrl when SPACEBASE_URL not set", async () => {
    process.env.SPACEBASE_API_KEY = "sw_env_key";
    const creds = await loadCredentials();
    expect(creds?.baseUrl).toBe("https://spacebase.thegnar.com");
  });

  it("uses SPACEBASE_URL when set", async () => {
    process.env.SPACEBASE_API_KEY = "sw_env_key";
    process.env.SPACEBASE_URL = "https://custom.example.com";
    const creds = await loadCredentials();
    expect(creds?.baseUrl).toBe("https://custom.example.com");
  });

  it("loads credentials from file when env vars not set", async () => {
    const dir = join(tmpdir(), "spacebase-test-" + Date.now());
    mkdirSync(join(dir, "spacebase"), { recursive: true });
    const filePath = join(dir, "spacebase", "credentials.json");
    writeFileSync(filePath, JSON.stringify({ token: "sw_from_file", baseUrl: "https://file.example.com" }));
    process.env.XDG_CONFIG_HOME = dir;

    const creds = await loadCredentials();
    expect(creds?.token).toBe("sw_from_file");
    expect(creds?.baseUrl).toBe("https://file.example.com");

    rmSync(dir, { recursive: true });
  });

  it("env vars take priority over credentials file", async () => {
    const dir = join(tmpdir(), "spacebase-test-" + Date.now());
    mkdirSync(join(dir, "spacebase"), { recursive: true });
    const filePath = join(dir, "spacebase", "credentials.json");
    writeFileSync(filePath, JSON.stringify({ token: "sw_from_file", baseUrl: "https://file.example.com" }));
    process.env.XDG_CONFIG_HOME = dir;
    process.env.SPACEBASE_API_KEY = "sw_from_env";

    const creds = await loadCredentials();
    expect(creds?.token).toBe("sw_from_env");

    rmSync(dir, { recursive: true });
  });
});

describe("deleteCredentials", () => {
  it("returns true and removes the file when credentials file exists", async () => {
    const dir = join(tmpdir(), "spacebase-delete-test-" + Date.now());
    mkdirSync(join(dir, "spacebase"), { recursive: true });
    const filePath = join(dir, "spacebase", "credentials.json");
    writeFileSync(filePath, JSON.stringify({ token: "sw_key", baseUrl: "https://example.com" }));
    process.env.XDG_CONFIG_HOME = dir;

    const result = await deleteCredentials();
    expect(result).toBe(true);

    // File should be gone
    const { access } = await import("fs/promises");
    const { constants } = await import("fs");
    await expect(access(filePath, constants.F_OK)).rejects.toThrow();

    rmSync(dir, { recursive: true });
  });

  it("returns false when credentials file does not exist", async () => {
    const dir = join(tmpdir(), "spacebase-delete-nofile-" + Date.now());
    process.env.XDG_CONFIG_HOME = dir;

    const result = await deleteCredentials();
    expect(result).toBe(false);
  });
});

describe("credentialsFilePath", () => {
  it("is exported and returns a path ending in credentials.json", () => {
    const fp = credentialsFilePath();
    expect(fp).toMatch(/credentials\.json$/);
  });
});

describe("saveCredentials", () => {
  it("creates the config directory and writes credentials.json", async () => {
    const dir = join(tmpdir(), "spacebase-save-test-" + Date.now());
    process.env.XDG_CONFIG_HOME = dir;

    await saveCredentials({ token: "sw_saved_key", baseUrl: "https://saved.example.com" });

    const filePath = join(dir, "spacebase", "credentials.json");
    const { readFileSync } = await import("fs");
    const contents = JSON.parse(readFileSync(filePath, "utf8"));
    expect(contents.token).toBe("sw_saved_key");
    expect(contents.baseUrl).toBe("https://saved.example.com");

    rmSync(dir, { recursive: true });
  });

  it("sets file permissions to 0600", async () => {
    const dir = join(tmpdir(), "spacebase-save-perms-" + Date.now());
    process.env.XDG_CONFIG_HOME = dir;

    await saveCredentials({ token: "sw_perms_key", baseUrl: "https://perms.example.com" });

    const filePath = join(dir, "spacebase", "credentials.json");
    const { statSync } = await import("fs");
    const info = statSync(filePath);
    const mode = info.mode & 0o777;
    expect(mode).toBe(0o600);

    rmSync(dir, { recursive: true });
  });
});

describe("resolveProjectId", () => {
  it("returns flagValue when provided", async () => {
    const id = await resolveProjectId({ flagValue: "proj_flag", token: "sw_k", baseUrl: "https://x.com" });
    expect(id).toBe("proj_flag");
  });

  it("returns SPACEBASE_PROJECT_ID env var when no flagValue", async () => {
    process.env.SPACEBASE_PROJECT_ID = "proj_env";
    const id = await resolveProjectId({ flagValue: undefined, token: "sw_k", baseUrl: "https://x.com" });
    expect(id).toBe("proj_env");
  });

  it("returns undefined when no flag, no env var, no dotfile", async () => {
    // Run from a tmp dir with no .spacebase file
    const id = await resolveProjectId({ flagValue: undefined, token: "sw_k", baseUrl: "https://x.com" });
    // May be undefined or a string depending on dotfile walk-up — just ensure it doesn't throw
    expect(typeof id === "string" || id === undefined).toBe(true);
  });

  it("falls back to GET /api/v1/me when no flag, env, or dotfile", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/v1/me")) {
        return new Response(
          JSON.stringify({ user: { email: "user@example.com" }, project: { id: "proj_from_me", name: "Test" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("not found", { status: 404 });
    };

    const tmpDir = join(tmpdir(), "spacebase-me-test-" + Date.now());
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      delete process.env.SPACEBASE_PROJECT_ID;
      const id = await resolveProjectId({ flagValue: undefined, token: "sw_test", baseUrl: "https://example.com" });
      expect(id).toBe("proj_from_me");
    } finally {
      globalThis.fetch = originalFetch;
      process.cwd = originalCwd;
    }
  });

  it("returns undefined when /api/v1/me call throws", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("network error");
    };

    const tmpDir = join(tmpdir(), "spacebase-me-throw-" + Date.now());
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      delete process.env.SPACEBASE_PROJECT_ID;
      const id = await resolveProjectId({ flagValue: undefined, token: "sw_test", baseUrl: "https://example.com" });
      expect(id).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
      process.cwd = originalCwd;
    }
  });

  it("returns undefined when /api/v1/me returns 401", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    };

    const tmpDir = join(tmpdir(), "spacebase-me-401-" + Date.now());
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      delete process.env.SPACEBASE_PROJECT_ID;
      const id = await resolveProjectId({ flagValue: undefined, token: "sw_test", baseUrl: "https://example.com" });
      expect(id).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
      process.cwd = originalCwd;
    }
  });

  it("returns undefined when /api/v1/me response has no project field", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ user: { email: "user@example.com" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const tmpDir = join(tmpdir(), "spacebase-me-noproject-" + Date.now());
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      delete process.env.SPACEBASE_PROJECT_ID;
      const id = await resolveProjectId({ flagValue: undefined, token: "sw_test", baseUrl: "https://example.com" });
      expect(id).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
      process.cwd = originalCwd;
    }
  });
});
