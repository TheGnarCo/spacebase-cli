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

describe("keys list", () => {
  it("calls GET /projects/{id}/keys and displays table", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify([
          { id: "key-1", name: "CI Key", prefix: "sw_ci", created_at: "2024-01-01" },
          { id: "key-2", name: "Dev Key", prefix: "sw_dev", created_at: "2024-02-01" },
        ]),
        { status: 200 }
      )
    );

    const tableSpy = spyOn(output, "table");
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "keys", "list"]);
    writeSpy.mockRestore();

    const calls = tableSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const rows = calls[calls.length - 1][0] as Array<Record<string, unknown>>;
    expect(rows[0].id).toBe("key-1");
    expect(rows[0].name).toBe("CI Key");
    expect(rows[0].prefix).toBe("sw_ci");
    expect(rows[0].created_at).toBe("2024-01-01");

    const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0] as string;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/keys`);

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
      await program.parseAsync(["node", "spacebase", "keys", "list"]);
    } catch {
      // expected — process.exit throws in mock
    }

    expect(exitCode).toBe(1);
    expect(errSpy.mock.calls.some((c) => String(c[0]).toLowerCase().includes("project"))).toBe(true);

    errSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

describe("keys create", () => {
  it("calls POST /projects/{id}/keys with name and displays full key value", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ id: "key-new", name: "My Key", prefix: "sw_my", key: "sw_mysecretfullvalue" }),
        { status: 200 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "keys", "create", "My Key"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("sw_mysecretfullvalue");

    const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const url = call[0] as string;
    const opts = call[1] as RequestInit;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/keys`);
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body as string);
    expect(body.name).toBe("My Key");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });
});

describe("keys revoke", () => {
  it("calls DELETE /projects/{id}/keys/{keyId} and prints confirmation", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(null, { status: 204 })
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "keys", "revoke", "key-1"]);

    const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const url = call[0] as string;
    const opts = call[1] as RequestInit;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/keys/key-1`);
    expect(opts.method).toBe("DELETE");

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("key-1");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });
});
