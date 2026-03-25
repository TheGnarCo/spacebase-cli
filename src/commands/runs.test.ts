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

describe("runs claim", () => {
  it("calls POST /runs/{runId}/claim and prints the claimed run", async () => {
    const mockRun = { id: TEST_RUN_ID, status: "claimed", created_at: "2026-03-25T00:00:00Z" };
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockRun), { status: 200 })
    );

    const tableSpy = spyOn(output, "table");
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "runs", "claim", TEST_RUN_ID]);
    writeSpy.mockRestore();

    const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0] as string;
    const opts = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][1] as RequestInit;
    expect(url).toContain(`/runs/${TEST_RUN_ID}/claim`);
    expect(opts.method).toBe("POST");

    const calls = tableSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const rows = calls[calls.length - 1][0] as Array<Record<string, unknown>>;
    expect(rows[0].id).toBe(TEST_RUN_ID);
    expect(rows[0].status).toBe("claimed");

    tableSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("outputs JSON when --json is passed", async () => {
    const mockRun = { id: TEST_RUN_ID, status: "claimed", created_at: "2026-03-25T00:00:00Z" };
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockRun), { status: 200 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "--json", "runs", "claim", TEST_RUN_ID]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written);
    expect(parsed.id).toBe(TEST_RUN_ID);
    expect(parsed.status).toBe("claimed");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });
});

describe("runs sources", () => {
  it("calls GET /runs/{runId}/sources and lists source artifacts", async () => {
    const mockSources = [
      { id: "src-1", filename: "brief.md", size: 512, created_at: "2026-03-25T00:00:00Z" },
      { id: "src-2", filename: "spec.pdf", size: 4096, created_at: "2026-03-25T01:00:00Z" },
    ];
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockSources), { status: 200 })
    );

    const tableSpy = spyOn(output, "table");
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "runs", "sources", TEST_RUN_ID]);
    writeSpy.mockRestore();

    const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0] as string;
    expect(url).toContain(`/runs/${TEST_RUN_ID}/sources`);
    expect(url).not.toContain(`/projects/`);

    const calls = tableSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const rows = calls[calls.length - 1][0] as Array<Record<string, unknown>>;
    expect(rows[0].filename).toBe("brief.md");
    expect(rows[1].filename).toBe("spec.pdf");

    tableSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("outputs JSON when --json is passed", async () => {
    const mockSources = [
      { id: "src-1", filename: "brief.md", size: 512, created_at: "2026-03-25T00:00:00Z" },
    ];
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockSources), { status: 200 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "--json", "runs", "sources", TEST_RUN_ID]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written);
    expect(parsed[0].filename).toBe("brief.md");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("downloads sources to --out directory when specified", async () => {
    const mockSources = [
      { id: "src-1", filename: "brief.md", size: 512, created_at: "2026-03-25T00:00:00Z", download_url: "/runs/run-xyz-789/sources/src-1/download" },
    ];

    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("/sources/src-1/download")) {
        return new Response("file contents", { status: 200 });
      }
      return new Response(JSON.stringify(mockSources), { status: 200 });
    });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    const fsPromises = await import("fs/promises");
    const writeFileSpy = spyOn(fsPromises, "writeFile").mockImplementation(async () => {});
    const mkdirSpy = spyOn(fsPromises, "mkdir").mockImplementation(async () => undefined);

    await program.parseAsync(["node", "spacebase", "runs", "sources", TEST_RUN_ID, "--out", "/tmp/test-sources-out"]);

    expect(writeFileSpy.mock.calls.length).toBeGreaterThan(0);
    const [writtenPath] = writeFileSpy.mock.calls[0];
    expect(String(writtenPath)).toContain("brief.md");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
    writeFileSpy.mockRestore();
    mkdirSpy.mockRestore();
  });
});

describe("runs upload", () => {
  it("calls POST /runs/{runId}/artifacts with multipart form data", async () => {
    const mockArtifact = { id: "art-new-1", filename: "report.md", size: 1024, created_at: "2026-03-25T00:00:00Z" };
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockArtifact), { status: 201 })
    );

    const fsPromises = await import("fs/promises");
    const readFileSpy = spyOn(fsPromises, "readFile").mockImplementation(async () => Buffer.from("file content"));

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "runs", "upload", TEST_RUN_ID, "/tmp/report.md"]);

    const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0] as string;
    expect(url).toContain(`/runs/${TEST_RUN_ID}/artifacts`);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain(mockArtifact.id);

    writeSpy.mockRestore();
    mockFetch.mockRestore();
    readFileSpy.mockRestore();
  });

  it("infers artifact type from filename when --type is omitted", async () => {
    const mockArtifact = { id: "art-prd-1", filename: "my-prd-doc.md", size: 1024, created_at: "2026-03-25T00:00:00Z" };
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockArtifact), { status: 201 })
    );

    const fsPromises = await import("fs/promises");
    const readFileSpy = spyOn(fsPromises, "readFile").mockImplementation(async () => Buffer.from("file content"));

    let capturedForm: FormData | undefined;
    const origFetch = globalThis.fetch;
    mockFetch.mockImplementation(async (_url, opts) => {
      capturedForm = opts?.body as FormData;
      return new Response(JSON.stringify(mockArtifact), { status: 201 });
    });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "runs", "upload", TEST_RUN_ID, "/tmp/my-prd-doc.md"]);

    expect(capturedForm).toBeDefined();
    expect(capturedForm!.get("type")).toBe("prd");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
    readFileSpy.mockRestore();
  });

  it("infers title from filename: strips extension and converts kebab/snake to Title Case", async () => {
    const mockArtifact = { id: "art-arch-1", filename: "architecture-overview.md", size: 1024, created_at: "2026-03-25T00:00:00Z" };
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockArtifact), { status: 201 })
    );

    const fsPromises = await import("fs/promises");
    const readFileSpy = spyOn(fsPromises, "readFile").mockImplementation(async () => Buffer.from("file content"));

    let capturedForm: FormData | undefined;
    mockFetch.mockImplementation(async (_url, opts) => {
      capturedForm = opts?.body as FormData;
      return new Response(JSON.stringify(mockArtifact), { status: 201 });
    });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "runs", "upload", TEST_RUN_ID, "/tmp/architecture-overview.md"]);

    expect(capturedForm).toBeDefined();
    expect(capturedForm!.get("title")).toBe("Architecture Overview");
    expect(capturedForm!.get("type")).toBe("architecture");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
    readFileSpy.mockRestore();
  });

  it("uses provided --type and --title flags when given", async () => {
    const mockArtifact = { id: "art-custom-1", filename: "myfile.md", size: 1024, created_at: "2026-03-25T00:00:00Z" };
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockArtifact), { status: 201 })
    );

    const fsPromises = await import("fs/promises");
    const readFileSpy = spyOn(fsPromises, "readFile").mockImplementation(async () => Buffer.from("file content"));

    let capturedForm: FormData | undefined;
    mockFetch.mockImplementation(async (_url, opts) => {
      capturedForm = opts?.body as FormData;
      return new Response(JSON.stringify(mockArtifact), { status: 201 });
    });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "runs", "upload", TEST_RUN_ID, "/tmp/myfile.md", "--type", "prd", "--title", "My Custom Title"]);

    expect(capturedForm).toBeDefined();
    expect(capturedForm!.get("type")).toBe("prd");
    expect(capturedForm!.get("title")).toBe("My Custom Title");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
    readFileSpy.mockRestore();
  });

  it("outputs JSON when --json is passed", async () => {
    const mockArtifact = { id: "art-new-1", filename: "report.md", size: 1024, created_at: "2026-03-25T00:00:00Z" };
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockArtifact), { status: 201 })
    );

    const fsPromises = await import("fs/promises");
    const readFileSpy = spyOn(fsPromises, "readFile").mockImplementation(async () => Buffer.from("file content"));

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "--json", "runs", "upload", TEST_RUN_ID, "/tmp/report.md"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written);
    expect(parsed.id).toBe("art-new-1");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
    readFileSpy.mockRestore();
  });
});

describe("runs update", () => {
  it("calls PATCH /runs/{runId} with status body", async () => {
    const mockRun = { id: TEST_RUN_ID, status: "completed", created_at: "2026-03-25T00:00:00Z" };
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockRun), { status: 200 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "runs", "update", TEST_RUN_ID, "--status", "completed"]);

    const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0] as string;
    const opts = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][1] as RequestInit;
    expect(url).toContain(`/runs/${TEST_RUN_ID}`);
    expect(opts.method).toBe("PATCH");

    const body = JSON.parse(opts.body as string);
    expect(body.status).toBe("completed");

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain(TEST_RUN_ID);

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("includes error message in body when --error is provided", async () => {
    const mockRun = { id: TEST_RUN_ID, status: "failed", created_at: "2026-03-25T00:00:00Z" };
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockRun), { status: 200 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "runs", "update", TEST_RUN_ID, "--status", "failed", "--error", "Something went wrong"]);

    const opts = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][1] as RequestInit;
    const body = JSON.parse(opts.body as string);
    expect(body.status).toBe("failed");
    expect(body.error).toBe("Something went wrong");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("outputs JSON when --json is passed", async () => {
    const mockRun = { id: TEST_RUN_ID, status: "completed", created_at: "2026-03-25T00:00:00Z" };
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(mockRun), { status: 200 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "--json", "runs", "update", TEST_RUN_ID, "--status", "completed"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written);
    expect(parsed.id).toBe(TEST_RUN_ID);
    expect(parsed.status).toBe("completed");

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
