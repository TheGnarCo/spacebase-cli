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

describe("artifacts list", () => {
  it("calls GET /projects/{id}/artifacts and displays table", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify([
          { id: "art-1", filename: "file.txt", tags: ["a", "b"], created_at: "2024-01-01" },
          { id: "art-2", filename: "data.csv", tags: [], created_at: "2024-01-02" },
        ]),
        { status: 200 }
      )
    );

    const tableSpy = spyOn(output, "table");
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "artifacts", "list"]);
    writeSpy.mockRestore();

    const calls = tableSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const rows = calls[calls.length - 1][0] as Array<Record<string, unknown>>;
    expect(rows[0].id).toBe("art-1");
    expect(rows[0].filename).toBe("file.txt");
    expect(rows[1].id).toBe("art-2");

    const fetchCalls = mockFetch.mock.calls;
    const url = fetchCalls[fetchCalls.length - 1][0] as string;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/artifacts`);

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
      await program.parseAsync(["node", "spacebase", "artifacts", "list"]);
    } catch {
      // expected — process.exit throws in mock
    }

    expect(exitCode).toBe(1);
    expect(errSpy.mock.calls.some((c) => String(c[0]).toLowerCase().includes("project"))).toBe(true);

    errSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

describe("artifacts upload", () => {
  it("calls POST /projects/{id}/artifacts with multipart form data", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ id: "art-new", filename: "upload.txt", tags: [], created_at: "2024-01-03" }),
        { status: 200 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    // Create a temp file to upload
    const tmpPath = "/tmp/spacebase-test-upload.txt";
    await Bun.write(tmpPath, "hello world content");

    await program.parseAsync(["node", "spacebase", "artifacts", "upload", tmpPath]);
    writeSpy.mockRestore();

    const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const url = call[0] as string;
    const opts = call[1] as RequestInit;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/artifacts`);
    expect(opts.method).toBe("POST");
    // body should be FormData (not a plain string)
    expect(opts.body).toBeInstanceOf(FormData);

    mockFetch.mockRestore();
  });

  it("includes tags in FormData when --tags is provided", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ id: "art-tagged", filename: "upload.txt", tags: ["t1", "t2"], created_at: "2024-01-03" }),
        { status: 200 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    const tmpPath = "/tmp/spacebase-test-upload-tags.txt";
    await Bun.write(tmpPath, "tagged content");

    await program.parseAsync([
      "node", "spacebase", "artifacts", "upload", tmpPath, "--tags", "t1,t2",
    ]);
    writeSpy.mockRestore();

    const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const body = call[1].body as FormData;
    expect(body.get("tags")).toBe("t1,t2");

    mockFetch.mockRestore();
  });

  it("prints confirmation after upload", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ id: "art-new", filename: "upload.txt", tags: [], created_at: "2024-01-03" }),
        { status: 200 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    const tmpPath = "/tmp/spacebase-test-upload-confirm.txt";
    await Bun.write(tmpPath, "content");

    await program.parseAsync(["node", "spacebase", "artifacts", "upload", tmpPath]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("art-new");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });
});

describe("artifacts download", () => {
  it("calls GET /projects/{id}/artifacts/{artifactId} and writes binary to stdout", async () => {
    const binaryContent = "binary file content";
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(binaryContent, { status: 200 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "artifacts", "download", "art-1"]);

    const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0] as string;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/artifacts/art-1`);

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("writes content to --out file when provided", async () => {
    const binaryContent = "file output content";
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(binaryContent, { status: 200 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    const outPath = "/tmp/spacebase-test-download-out.bin";

    await program.parseAsync([
      "node", "spacebase", "artifacts", "download", "art-1", "--out", outPath,
    ]);
    writeSpy.mockRestore();

    const written = await Bun.file(outPath).text();
    expect(written).toBe(binaryContent);

    mockFetch.mockRestore();
  });
});

describe("artifacts delete", () => {
  it("calls DELETE /projects/{id}/artifacts/{artifactId}", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(null, { status: 204 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "artifacts", "delete", "art-1"]);

    const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const url = call[0] as string;
    const opts = call[1] as RequestInit;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/artifacts/art-1`);
    expect(opts.method).toBe("DELETE");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("prints confirmation after delete", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(null, { status: 204 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "artifacts", "delete", "art-1"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("art-1");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });
});

describe("artifacts tags", () => {
  it("calls GET /projects/{id}/artifacts/{artifactId}/tags and displays tags", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify(["tag1", "tag2", "tag3"]),
        { status: 200 }
      )
    );

    const tableSpy = spyOn(output, "table");
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "artifacts", "tags", "art-1"]);
    writeSpy.mockRestore();

    const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0] as string;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/artifacts/art-1/tags`);

    const calls = tableSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    tableSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("calls PUT /projects/{id}/artifacts/{artifactId}/tags when --set is provided", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify(["new1", "new2"]),
        { status: 200 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync([
      "node", "spacebase", "artifacts", "tags", "art-1", "--set", "new1,new2",
    ]);
    writeSpy.mockRestore();

    const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const url = call[0] as string;
    const opts = call[1] as RequestInit;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/artifacts/art-1/tags`);
    expect(opts.method).toBe("PUT");
    const body = JSON.parse(opts.body as string);
    expect(body).toEqual(["new1", "new2"]);

    mockFetch.mockRestore();
  });
});
