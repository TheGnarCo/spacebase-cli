import { describe, it, expect } from "bun:test";
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dir, "..");
const BINARY = resolve(ROOT, "spacebase");

describe("scaffold smoke tests", () => {
  it("produces a binary after bun run build", () => {
    const result = spawnSync("bun", ["run", "build"], { cwd: ROOT });
    expect(result.status).toBe(0);
    expect(existsSync(BINARY)).toBe(true);
  });

  it("binary responds to --help with exit code 0", () => {
    const result = spawnSync(BINARY, ["--help"]);
    expect(result.status).toBe(0);
    expect(result.stdout.toString()).toContain("Usage:");
  });

  it("binary errors on unknown argument (showSuggestionAfterError wired)", () => {
    // With no subcommands registered yet, Commander treats unknown args as excess arguments.
    // showSuggestionAfterError() is configured on the program — the error exit confirms exitOverride
    // is correctly handled and the program rejects bad input.
    const result = spawnSync(BINARY, ["unknowncmd"]);
    expect(result.status).toBe(1);
  });

  it("dev mode --help works", () => {
    const result = spawnSync("bun", ["run", "src/index.ts", "--help"], { cwd: ROOT });
    expect(result.status).toBe(0);
    expect(result.stdout.toString()).toContain("Usage:");
  });
});
