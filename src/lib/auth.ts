import { readFile, access, stat, unlink, mkdir, writeFile, chmod } from "fs/promises";
import { constants } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { GlobalOpts } from "../cli";

export interface StoredCredentials {
  apiKey: string;
  baseUrl: string;
}

const DEFAULT_BASE_URL = "https://spacebase.thegnar.com";

export function credentialsFilePath(): string {
  const configHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(configHome, "spacebase", "credentials.json");
}

export async function loadCredentials(opts?: Pick<GlobalOpts, "apiKey" | "url">): Promise<StoredCredentials | undefined> {
  // Priority 1: flag overrides
  if (opts?.apiKey) {
    return {
      apiKey: opts.apiKey,
      baseUrl: opts.url ?? DEFAULT_BASE_URL,
    };
  }

  // Priority 2: env vars
  const apiKey = process.env.SPACEBASE_API_KEY;
  if (apiKey) {
    return {
      apiKey,
      baseUrl: process.env.SPACEBASE_URL ?? DEFAULT_BASE_URL,
    };
  }

  // Priority 2: credentials file
  const filePath = credentialsFilePath();
  try {
    await access(filePath, constants.R_OK);
  } catch {
    return undefined;
  }

  // Warn if permissions are not 0600
  try {
    const info = await stat(filePath);
    const mode = info.mode & 0o777;
    if (mode !== 0o600) {
      process.stderr.write(
        `Warning: credentials file ${filePath} has permissions ${mode.toString(8)}, expected 600\n`
      );
    }
  } catch {
    // ignore stat errors
  }

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as StoredCredentials;
    return parsed;
  } catch {
    return undefined;
  }
}

export async function saveCredentials(creds: StoredCredentials): Promise<void> {
  const filePath = credentialsFilePath();
  const dir = join(filePath, "..");
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(creds, null, 2), "utf8");
  await chmod(filePath, 0o600);
}

export async function deleteCredentials(): Promise<boolean> {
  const filePath = credentialsFilePath();
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveProjectId(opts: {
  flagValue: string | undefined;
  apiKey: string;
  baseUrl: string;
}): Promise<string | undefined> {
  // Priority 1: --project flag
  if (opts.flagValue) return opts.flagValue;

  // Priority 2: env var
  if (process.env.SPACEBASE_PROJECT_ID) return process.env.SPACEBASE_PROJECT_ID;

  // Priority 3: .spacebase dotfile walk-up
  const dotfileId = await walkUpForDotfile(process.cwd());
  if (dotfileId) return dotfileId;

  // Priority 4: GET /api/v1/me — deferred to preaction-wiring story
  // TODO: call GET /api/v1/me and return project ID from response

  return undefined;
}

async function walkUpForDotfile(startDir: string): Promise<string | undefined> {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, ".spacebase");
    try {
      const content = await readFile(candidate, "utf8");
      const trimmed = content.trim();
      if (trimmed) return trimmed;
    } catch {
      // not found at this level
    }
    const parent = join(dir, "..");
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return undefined;
}
