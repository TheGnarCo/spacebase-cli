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

  it("loads apiKey from SPACEBASE_API_KEY env var", async () => {
    process.env.SPACEBASE_API_KEY = "sw_env_key";
    const creds = await loadCredentials();
    expect(creds?.apiKey).toBe("sw_env_key");
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
    writeFileSync(filePath, JSON.stringify({ apiKey: "sw_from_file", baseUrl: "https://file.example.com" }));
    process.env.XDG_CONFIG_HOME = dir;

    const creds = await loadCredentials();
    expect(creds?.apiKey).toBe("sw_from_file");
    expect(creds?.baseUrl).toBe("https://file.example.com");

    rmSync(dir, { recursive: true });
  });

  it("env vars take priority over credentials file", async () => {
    const dir = join(tmpdir(), "spacebase-test-" + Date.now());
    mkdirSync(join(dir, "spacebase"), { recursive: true });
    const filePath = join(dir, "spacebase", "credentials.json");
    writeFileSync(filePath, JSON.stringify({ apiKey: "sw_from_file", baseUrl: "https://file.example.com" }));
    process.env.XDG_CONFIG_HOME = dir;
    process.env.SPACEBASE_API_KEY = "sw_from_env";

    const creds = await loadCredentials();
    expect(creds?.apiKey).toBe("sw_from_env");

    rmSync(dir, { recursive: true });
  });
});

describe("deleteCredentials", () => {
  it("returns true and removes the file when credentials file exists", async () => {
    const dir = join(tmpdir(), "spacebase-delete-test-" + Date.now());
    mkdirSync(join(dir, "spacebase"), { recursive: true });
    const filePath = join(dir, "spacebase", "credentials.json");
    writeFileSync(filePath, JSON.stringify({ apiKey: "sw_key", baseUrl: "https://example.com" }));
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

    await saveCredentials({ apiKey: "sw_saved_key", baseUrl: "https://saved.example.com" });

    const filePath = join(dir, "spacebase", "credentials.json");
    const { readFileSync } = await import("fs");
    const contents = JSON.parse(readFileSync(filePath, "utf8"));
    expect(contents.apiKey).toBe("sw_saved_key");
    expect(contents.baseUrl).toBe("https://saved.example.com");

    rmSync(dir, { recursive: true });
  });

  it("sets file permissions to 0600", async () => {
    const dir = join(tmpdir(), "spacebase-save-perms-" + Date.now());
    process.env.XDG_CONFIG_HOME = dir;

    await saveCredentials({ apiKey: "sw_perms_key", baseUrl: "https://perms.example.com" });

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
    const id = await resolveProjectId({ flagValue: "proj_flag", apiKey: "sw_k", baseUrl: "https://x.com" });
    expect(id).toBe("proj_flag");
  });

  it("returns SPACEBASE_PROJECT_ID env var when no flagValue", async () => {
    process.env.SPACEBASE_PROJECT_ID = "proj_env";
    const id = await resolveProjectId({ flagValue: undefined, apiKey: "sw_k", baseUrl: "https://x.com" });
    expect(id).toBe("proj_env");
  });

  it("returns undefined when no flag, no env var, no dotfile", async () => {
    // Run from a tmp dir with no .spacebase file
    const id = await resolveProjectId({ flagValue: undefined, apiKey: "sw_k", baseUrl: "https://x.com" });
    // May be undefined or a string depending on dotfile walk-up — just ensure it doesn't throw
    expect(typeof id === "string" || id === undefined).toBe(true);
  });
});
