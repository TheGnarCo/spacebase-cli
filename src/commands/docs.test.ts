import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { program } from "../cli";
import { output } from "../lib/output";
import { resetContext } from "../lib/context";
import { mkdtemp, readFile, writeFile, readdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createHash } from "crypto";

const TEST_API_KEY = "sw_testkey1234";
const TEST_PROJECT_ID = "proj-test-abc";

beforeEach(() => {
  resetContext();
  output.configure({ json: false });
  process.env.SPACEBASE_API_KEY = TEST_API_KEY;
  process.env.SPACEBASE_PROJECT_ID = TEST_PROJECT_ID;
});

afterEach(() => {
  resetContext();
  output.configure({ json: false });
  delete process.env.SPACEBASE_API_KEY;
  delete process.env.SPACEBASE_PROJECT_ID;
});

describe("docs list", () => {
  it("calls GET /projects/{id}/docs and displays table", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify([
          { id: "doc-1", title: "Intro", folder: "general", locked: false },
          { id: "doc-2", title: "Guide", folder: "howto", locked: true },
        ]),
        { status: 200 }
      )
    );

    const tableSpy = spyOn(output, "table");
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "docs", "list"]);
    writeSpy.mockRestore();

    const calls = tableSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const rows = calls[calls.length - 1][0] as Array<Record<string, unknown>>;
    expect(rows[0].id).toBe("doc-1");
    expect(rows[0].title).toBe("Intro");
    expect(rows[1].locked).toBe(true);

    const fetchCalls = mockFetch.mock.calls;
    const url = fetchCalls[fetchCalls.length - 1][0] as string;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/docs`);

    tableSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("errors and exits 1 if no projectId is resolved", async () => {
    delete process.env.SPACEBASE_PROJECT_ID;

    const errSpy = spyOn(output, "error").mockImplementation(() => {});
    let exitCode: number | undefined;
    const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    });

    try {
      await program.parseAsync(["node", "spacebase", "docs", "list"]);
    } catch {
      // expected — process.exit throws in mock
    }

    expect(exitCode).toBe(1);
    expect(errSpy.mock.calls.some((c) => String(c[0]).toLowerCase().includes("project"))).toBe(true);

    errSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

describe("docs get", () => {
  it("calls GET /projects/{id}/docs/{docId}/raw and writes to stdout", async () => {
    const rawContent = "# Hello\n\nThis is the doc.";
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(rawContent, { status: 200 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "docs", "get", "doc-1"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain(rawContent);

    const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0] as string;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/docs/doc-1/raw`);

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });
});

describe("docs create", () => {
  it("calls POST /projects/{id}/docs with title", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ id: "doc-new", title: "My Doc", folder: null, locked: false }),
        { status: 200 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "docs", "create", "My Doc"]);
    writeSpy.mockRestore();

    const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const url = call[0] as string;
    const opts = call[1] as RequestInit;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/docs`);
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body as string);
    expect(body.title).toBe("My Doc");

    mockFetch.mockRestore();
  });

  it("includes folder in POST body when --folder is provided", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ id: "doc-new2", title: "Doc2", folder: "myfolder", locked: false }),
        { status: 200 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync([
      "node", "spacebase", "docs", "create", "Doc2", "--folder", "myfolder",
    ]);
    writeSpy.mockRestore();

    const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.folder).toBe("myfolder");

    mockFetch.mockRestore();
  });
});

describe("docs update", () => {
  it("calls PUT /projects/{id}/docs/{docId} with provided flags", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ id: "doc-1", title: "Updated", folder: "newfolder", locked: false }),
        { status: 200 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync([
      "node", "spacebase", "docs", "update", "doc-1", "--title", "Updated", "--folder", "newfolder",
    ]);
    writeSpy.mockRestore();

    const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const url = call[0] as string;
    const opts = call[1] as RequestInit;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/docs/doc-1`);
    expect(opts.method).toBe("PUT");
    const body = JSON.parse(opts.body as string);
    expect(body.title).toBe("Updated");
    expect(body.folder).toBe("newfolder");

    mockFetch.mockRestore();
  });
});

describe("docs delete", () => {
  it("calls DELETE /projects/{id}/docs/{docId}", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(null, { status: 204 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "docs", "delete", "doc-1"]);

    const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const url = call[0] as string;
    const opts = call[1] as RequestInit;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/docs/doc-1`);
    expect(opts.method).toBe("DELETE");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("prints confirmation after delete", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(null, { status: 204 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "docs", "delete", "doc-1"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("doc-1");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });
});

describe("docs lock", () => {
  it("calls PATCH /projects/{id}/docs/{docId}/lock", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ id: "doc-1", title: "Intro", folder: "general", locked: true }),
        { status: 200 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "docs", "lock", "doc-1"]);
    writeSpy.mockRestore();

    const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const url = call[0] as string;
    const opts = call[1] as RequestInit;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/docs/doc-1/lock`);
    expect(opts.method).toBe("PATCH");

    mockFetch.mockRestore();
  });
});

/* ============================================================
 * docs pull — tests for the pull subcommand
 * ============================================================ */

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

describe("docs pull", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "spacebase-pull-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("fetches all docs and writes files plus manifest", async () => {
    const docsListResponse = [
      { id: "doc-1", title: "Intro", folder: null, locked: false },
      { id: "doc-2", title: "Guide", folder: null, locked: false },
    ];
    const rawContents: Record<string, string> = {
      "doc-1": "# Intro\n\nWelcome.",
      "doc-2": "# Guide\n\nHow to use.",
    };

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.endsWith("/docs")) {
        return new Response(JSON.stringify(docsListResponse), { status: 200 });
      }
      if (urlStr.includes("/docs/doc-1/raw")) {
        return new Response(rawContents["doc-1"], { status: 200 });
      }
      if (urlStr.includes("/docs/doc-2/raw")) {
        return new Response(rawContents["doc-2"], { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "docs", "pull", tempDir]);
    writeSpy.mockRestore();

    // Check files were written
    const introContent = await readFile(join(tempDir, "Intro.md"), "utf8");
    expect(introContent).toBe(rawContents["doc-1"]);

    const guideContent = await readFile(join(tempDir, "Guide.md"), "utf8");
    expect(guideContent).toBe(rawContents["doc-2"]);

    // Check manifest was written
    const manifestRaw = await readFile(join(tempDir, ".spacebase-manifest.json"), "utf8");
    const manifest = JSON.parse(manifestRaw);
    expect(manifest["Intro.md"]).toBeDefined();
    expect(manifest["Intro.md"].docId).toBe("doc-1");
    expect(manifest["Intro.md"].title).toBe("Intro");
    expect(manifest["Intro.md"].checksum).toBe(sha256(rawContents["doc-1"]));
    expect(manifest["Guide.md"].docId).toBe("doc-2");

    mockFetch.mockRestore();
  });

  it("defaults directory to ./docs when no argument given", async () => {
    const docsListResponse = [
      { id: "doc-1", title: "Test", folder: null, locked: false },
    ];

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.endsWith("/docs")) {
        return new Response(JSON.stringify(docsListResponse), { status: 200 });
      }
      if (urlStr.includes("/raw")) {
        return new Response("content", { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });

    const cwdDir = await mkdtemp(join(tmpdir(), "spacebase-pull-cwd-"));
    const originalCwd = process.cwd();
    process.chdir(cwdDir);

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      await program.parseAsync(["node", "spacebase", "docs", "pull"]);
    } finally {
      writeSpy.mockRestore();
      process.chdir(originalCwd);
    }

    const files = await readdir(join(cwdDir, "docs"));
    expect(files).toContain("Test.md");

    await rm(cwdDir, { recursive: true, force: true });
    mockFetch.mockRestore();
  });

  it("handles partial failures gracefully", async () => {
    const docsListResponse = [
      { id: "doc-1", title: "Good", folder: null, locked: false },
      { id: "doc-2", title: "Bad", folder: null, locked: false },
    ];

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.endsWith("/docs")) {
        return new Response(JSON.stringify(docsListResponse), { status: 200 });
      }
      if (urlStr.includes("/docs/doc-1/raw")) {
        return new Response("good content", { status: 200 });
      }
      if (urlStr.includes("/docs/doc-2/raw")) {
        return new Response(JSON.stringify({ error: "server error" }), { status: 500 });
      }
      return new Response("not found", { status: 404 });
    });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    const errSpy = spyOn(process.stderr, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "docs", "pull", tempDir]);
    writeSpy.mockRestore();
    errSpy.mockRestore();

    // Good doc should still be written
    const goodContent = await readFile(join(tempDir, "Good.md"), "utf8");
    expect(goodContent).toBe("good content");

    // Bad doc should not exist
    const files = await readdir(tempDir);
    expect(files).not.toContain("Bad.md");

    // Manifest should only have the successful doc
    const manifestRaw = await readFile(join(tempDir, ".spacebase-manifest.json"), "utf8");
    const manifest = JSON.parse(manifestRaw);
    expect(manifest["Good.md"]).toBeDefined();
    expect(manifest["Bad.md"]).toBeUndefined();

    mockFetch.mockRestore();
  });

  it("prints summary of pulled docs", async () => {
    const docsListResponse = [
      { id: "doc-1", title: "OnlyDoc", folder: null, locked: false },
    ];

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.endsWith("/docs")) {
        return new Response(JSON.stringify(docsListResponse), { status: 200 });
      }
      if (urlStr.includes("/raw")) {
        return new Response("content here", { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "docs", "pull", tempDir]);

    const written = writeSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(written).toContain("1");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });
});

/* ============================================================
 * docs push — tests for the push subcommand
 * ============================================================ */

describe("docs push", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "spacebase-push-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates new docs for files not in manifest", async () => {
    await writeFile(join(tempDir, ".spacebase-manifest.json"), JSON.stringify({}));
    await writeFile(join(tempDir, "NewDoc.md"), "# New Doc\n\nBrand new.");

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const urlStr = String(url);
      const opts = init as RequestInit;
      if (urlStr.endsWith("/docs") && opts.method === "POST") {
        return new Response(
          JSON.stringify({ id: "doc-new", title: "NewDoc", folder: null, locked: false }),
          { status: 200 }
        );
      }
      return new Response("not found", { status: 404 });
    });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "docs", "push", tempDir]);
    writeSpy.mockRestore();

    // Verify POST was called
    const postCalls = mockFetch.mock.calls.filter((c) => {
      const opts = c[1] as RequestInit;
      return opts.method === "POST";
    });
    expect(postCalls.length).toBe(1);
    const body = JSON.parse((postCalls[0][1] as RequestInit).body as string);
    expect(body.title).toBe("NewDoc");
    expect(body.content).toBe("# New Doc\n\nBrand new.");

    // Manifest should be updated with new doc
    const manifestRaw = await readFile(join(tempDir, ".spacebase-manifest.json"), "utf8");
    const manifest = JSON.parse(manifestRaw);
    expect(manifest["NewDoc.md"]).toBeDefined();
    expect(manifest["NewDoc.md"].docId).toBe("doc-new");

    mockFetch.mockRestore();
  });

  it("updates modified files (checksum changed)", async () => {
    const originalContent = "original content";
    const modifiedContent = "modified content";
    const originalChecksum = sha256(originalContent);

    const manifest = {
      "Existing.md": { docId: "doc-1", title: "Existing", checksum: originalChecksum },
    };
    await writeFile(join(tempDir, ".spacebase-manifest.json"), JSON.stringify(manifest));
    await writeFile(join(tempDir, "Existing.md"), modifiedContent);

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const urlStr = String(url);
      const opts = init as RequestInit;
      if (urlStr.includes("/docs/doc-1") && opts.method === "PUT") {
        return new Response(
          JSON.stringify({ id: "doc-1", title: "Existing", folder: null, locked: false }),
          { status: 200 }
        );
      }
      return new Response("not found", { status: 404 });
    });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "docs", "push", tempDir]);
    writeSpy.mockRestore();

    // Verify PUT was called with updated content
    const putCalls = mockFetch.mock.calls.filter((c) => {
      const opts = c[1] as RequestInit;
      return opts.method === "PUT";
    });
    expect(putCalls.length).toBe(1);
    const body = JSON.parse((putCalls[0][1] as RequestInit).body as string);
    expect(body.content).toBe(modifiedContent);

    // Manifest should have updated checksum
    const manifestRaw = await readFile(join(tempDir, ".spacebase-manifest.json"), "utf8");
    const updatedManifest = JSON.parse(manifestRaw);
    expect(updatedManifest["Existing.md"].checksum).toBe(sha256(modifiedContent));

    mockFetch.mockRestore();
  });

  it("skips unchanged files", async () => {
    const content = "unchanged content";
    const checksum = sha256(content);

    const manifest = {
      "Same.md": { docId: "doc-1", title: "Same", checksum },
    };
    await writeFile(join(tempDir, ".spacebase-manifest.json"), JSON.stringify(manifest));
    await writeFile(join(tempDir, "Same.md"), content);

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response("should not be called", { status: 500 });
    });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "docs", "push", tempDir]);
    writeSpy.mockRestore();

    // No API calls should have been made
    expect(mockFetch.mock.calls.length).toBe(0);

    mockFetch.mockRestore();
  });

  it("reports deleted files without auto-deleting from API", async () => {
    const manifest = {
      "Gone.md": { docId: "doc-gone", title: "Gone", checksum: "abc123" },
    };
    await writeFile(join(tempDir, ".spacebase-manifest.json"), JSON.stringify(manifest));

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response("should not be called", { status: 500 });
    });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    const errSpy = spyOn(process.stderr, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "docs", "push", tempDir]);

    const allOutput = [
      ...writeSpy.mock.calls.map((c) => String(c[0])),
      ...errSpy.mock.calls.map((c) => String(c[0])),
    ].join("");
    expect(allOutput.toLowerCase()).toContain("gone");

    // No DELETE calls should have been made
    expect(mockFetch.mock.calls.length).toBe(0);

    writeSpy.mockRestore();
    errSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("prints summary of push actions", async () => {
    await writeFile(join(tempDir, ".spacebase-manifest.json"), JSON.stringify({}));
    await writeFile(join(tempDir, "New.md"), "# New");

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ id: "doc-new", title: "New", folder: null, locked: false }),
        { status: 200 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "docs", "push", tempDir]);

    const written = writeSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(written).toContain("1");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });
});
