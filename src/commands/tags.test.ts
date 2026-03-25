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

describe("tags list", () => {
  it("calls GET /projects/{id}/tags and displays table", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify([
          { id: "tag-1", name: "feature" },
          { id: "tag-2", name: "bug" },
        ]),
        { status: 200 }
      )
    );

    const tableSpy = spyOn(output, "table");
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "tags", "list"]);
    writeSpy.mockRestore();

    const calls = tableSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const rows = calls[calls.length - 1][0] as Array<Record<string, unknown>>;
    expect(rows[0].id).toBe("tag-1");
    expect(rows[0].name).toBe("feature");
    expect(rows[1].name).toBe("bug");

    const fetchCalls = mockFetch.mock.calls;
    const url = fetchCalls[fetchCalls.length - 1][0] as string;
    expect(url).toContain(`/projects/${TEST_PROJECT_ID}/tags`);

    tableSpy.mockRestore();
    mockFetch.mockRestore();
  });

  it("outputs JSON when --json flag is set", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify([{ id: "tag-1", name: "feature" }]),
        { status: 200 }
      )
    );

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    await program.parseAsync(["node", "spacebase", "--json", "tags", "list"]);

    const written = writeSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe("tag-1");
    expect(parsed[0].name).toBe("feature");

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
      await program.parseAsync(["node", "spacebase", "tags", "list"]);
    } catch {
      // expected — process.exit throws in mock
    }

    expect(exitCode).toBe(1);
    expect(errSpy.mock.calls.some((c) => String(c[0]).toLowerCase().includes("project"))).toBe(true);

    errSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
