import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { program } from "../cli";
import { output } from "../lib/output";
import { resetContext } from "../lib/context";

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
