import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { program } from "../cli";
import { output } from "../lib/output";
import { resetContext } from "../lib/context";

const TEST_API_KEY = "sw_testkey1234";
const TEST_PROJECT_ID = "proj-test-abc";
const TEST_RUN_ID = "run-xyz-789";

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

describe("runs trigger", () => {
  it("calls POST /projects/{id}/runs and prints the run ID", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ id: TEST_RUN_ID, status: "pending", created_at: "2026-03-25T00:00:00Z" }),
        { status: 201 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "runs", "trigger"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain(TEST_RUN_ID);

    const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const url = call[0] as string;
    const opts = call[1] as RequestInit;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/runs`);
    expect(opts.method).toBe("POST");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("outputs JSON when --json is passed", async () => {
    const mockRun = { id: TEST_RUN_ID, status: "pending", created_at: "2026-03-25T00:00:00Z" };
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockRun), { status: 201 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "--json", "runs", "trigger"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written);
    expect(parsed.id).toBe(TEST_RUN_ID);

    writeSpy.mockRestore();
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
      await program.parseAsync(["node", "spacebase", "runs", "trigger"]);
    } catch {
      // expected
    }

    expect(exitCode).toBe(1);
    expect(errSpy.mock.calls.some((c) => String(c[0]).toLowerCase().includes("project"))).toBe(true);

    errSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

describe("runs status", () => {
  it("calls GET /runs/{runId} and displays run info", async () => {
    const mockRun = {
      id: TEST_RUN_ID,
      status: "completed",
      created_at: "2026-03-25T00:00:00Z",
    };
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockRun), { status: 200 })
    );

    const tableSpy = spyOn(output, "table");
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "runs", "status", TEST_RUN_ID]);
    writeSpy.mockRestore();

    const calls = tableSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const rows = calls[calls.length - 1][0] as Array<Record<string, unknown>>;
    expect(rows[0].id).toBe(TEST_RUN_ID);
    expect(rows[0].status).toBe("completed");

    const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0] as string;
    expect(url).toContain(`/runs/${TEST_RUN_ID}`);
    expect(url).not.toContain(`/projects/`);

    tableSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("outputs JSON when --json is passed", async () => {
    const mockRun = { id: TEST_RUN_ID, status: "completed", created_at: "2026-03-25T00:00:00Z" };
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockRun), { status: 200 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "--json", "runs", "status", TEST_RUN_ID]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written);
    expect(parsed.id).toBe(TEST_RUN_ID);

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });
});

describe("runs artifacts", () => {
  it("calls GET /runs/{runId}/artifacts and lists files", async () => {
    const mockArtifacts = [
      { id: "art-1", filename: "output.txt", size: 1024, created_at: "2026-03-25T00:00:00Z" },
      { id: "art-2", filename: "report.md", size: 2048, created_at: "2026-03-25T01:00:00Z" },
    ];
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockArtifacts), { status: 200 })
    );

    const tableSpy = spyOn(output, "table");
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "runs", "artifacts", TEST_RUN_ID]);
    writeSpy.mockRestore();

    const calls = tableSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const rows = calls[calls.length - 1][0] as Array<Record<string, unknown>>;
    expect(rows[0].filename).toBe("output.txt");
    expect(rows[1].filename).toBe("report.md");

    const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0] as string;
    expect(url).toContain(`/runs/${TEST_RUN_ID}/artifacts`);
    expect(url).not.toContain(`/projects/`);

    tableSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("outputs JSON when --json is passed", async () => {
    const mockArtifacts = [
      { id: "art-1", filename: "output.txt", size: 1024, created_at: "2026-03-25T00:00:00Z" },
    ];
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockArtifacts), { status: 200 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "--json", "runs", "artifacts", TEST_RUN_ID]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written);
    expect(parsed[0].filename).toBe("output.txt");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("downloads artifacts to --out directory when specified", async () => {
    const mockArtifacts = [
      { id: "art-1", filename: "output.txt", size: 1024, created_at: "2026-03-25T00:00:00Z", download_url: "/runs/run-xyz-789/artifacts/art-1/download" },
    ];

    let fetchCallCount = 0;
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      fetchCallCount++;
      if (String(url).includes("/artifacts/art-1/download")) {
        return new Response("file contents", { status: 200 });
      }
      return new Response(JSON.stringify(mockArtifacts), { status: 200 });
    });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    // Mock fs/promises writeFile to avoid actual disk writes
    const fsPromises = await import("fs/promises");
    const writeFileSpy = spyOn(fsPromises, "writeFile").mockImplementation(async () => {});
    const mkdirSpy = spyOn(fsPromises, "mkdir").mockImplementation(async () => undefined);

    await program.parseAsync(["node", "spacebase", "runs", "artifacts", TEST_RUN_ID, "--out", "/tmp/test-out"]);

    expect(writeFileSpy.mock.calls.length).toBeGreaterThan(0);
    const [writtenPath] = writeFileSpy.mock.calls[0];
    expect(String(writtenPath)).toContain("output.txt");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
    writeFileSpy.mockRestore();
    mkdirSpy.mockRestore();
  });
});
