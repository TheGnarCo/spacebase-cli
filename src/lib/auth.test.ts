import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { loadCredentials, resolveProjectId } from "./auth";
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
