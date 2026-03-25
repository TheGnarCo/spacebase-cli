import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { program } from "../cli";
import { output } from "../lib/output";
import { resetContext } from "../lib/context";

const TEST_API_KEY = "sw_testkey1234";

beforeEach(() => {
  resetContext();
  output.configure({ json: false });
  process.env.SPACEBASE_API_KEY = TEST_API_KEY;
});

afterEach(() => {
  resetContext();
  output.configure({ json: false });
  delete process.env.SPACEBASE_API_KEY;
});

describe("clients list", () => {
  it("calls GET /clients and displays table", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify([
          { id: "client-1", name: "Acme Corp", created_at: "2025-01-01T00:00:00Z" },
          { id: "client-2", name: "Globex", created_at: "2025-02-01T00:00:00Z" },
        ]),
        { status: 200 }
      )
    );

    const tableSpy = spyOn(output, "table");
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "clients", "list"]);
    writeSpy.mockRestore();

    const calls = tableSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const rows = calls[calls.length - 1][0] as Array<Record<string, unknown>>;
    expect(rows[0].id).toBe("client-1");
    expect(rows[0].name).toBe("Acme Corp");
    expect(rows[1].name).toBe("Globex");

    const fetchCalls = mockFetch.mock.calls;
    const url = fetchCalls[fetchCalls.length - 1][0] as string;
    expect(url).toContain("/clients");
    expect(url).not.toContain("/projects/");

    tableSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("outputs JSON when --json flag is passed", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify([{ id: "client-1", name: "Acme Corp", created_at: "2025-01-01T00:00:00Z" }]),
        { status: 200 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "--json", "clients", "list"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe("client-1");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });
});

describe("clients get", () => {
  it("calls GET /clients/{clientId} and displays detail", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ id: "client-1", name: "Acme Corp", created_at: "2025-01-01T00:00:00Z" }),
        { status: 200 }
      )
    );

    const tableSpy = spyOn(output, "table");
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "clients", "get", "client-1"]);
    writeSpy.mockRestore();

    const calls = tableSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const rows = calls[calls.length - 1][0] as Array<Record<string, unknown>>;
    expect(rows[0].id).toBe("client-1");
    expect(rows[0].name).toBe("Acme Corp");

    const fetchCalls = mockFetch.mock.calls;
    const url = fetchCalls[fetchCalls.length - 1][0] as string;
    expect(url).toContain("/clients/client-1");
    expect(url).not.toContain("/projects/");

    tableSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("outputs JSON when --json flag is passed", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ id: "client-1", name: "Acme Corp", created_at: "2025-01-01T00:00:00Z" }),
        { status: 200 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "--json", "clients", "get", "client-1"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written);
    expect(parsed.id).toBe("client-1");

    writeSpy.mockRestore();
    mockFetch.mockRestore();
  });
});
