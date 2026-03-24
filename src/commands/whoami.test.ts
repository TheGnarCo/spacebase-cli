import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { resetContext } from "../lib/context";
import { output } from "../lib/output";
import { program } from "../cli";

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

describe("whoamiCommand handler", () => {
  it("masks API key in table output (no --json flag)", async () => {
    // Without --json, opts.json is false → handler passes masked key to output.table
    const spy = spyOn(output, "table");
    await program.parseAsync(["node", "spacebase", "whoami"]);
    const calls = spy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1] as [Array<Record<string, string>>, unknown[]];
    expect(lastCall[0][0].apiKey).toBe("sw_...1234");
    spy.mockRestore();
  });

  it("shows full API key in JSON mode", async () => {
    const spy = spyOn(output, "table");
    await program.parseAsync(["node", "spacebase", "--json", "whoami"]);
    const calls = spy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1] as [Array<Record<string, string>>, unknown[]];
    expect(lastCall[0][0].apiKey).toBe(TEST_API_KEY);
    spy.mockRestore();
  });

  it("shows (none) for projectId when not resolved", async () => {
    // No project env var, no dotfile → projectId is undefined → (none)
    delete process.env.SPACEBASE_PROJECT_ID;
    const spy = spyOn(output, "table");
    await program.parseAsync(["node", "spacebase", "--json", "whoami"]);
    const calls = spy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1] as [Array<Record<string, string>>, unknown[]];
    expect(lastCall[0][0].projectId).toBe("(none)");
    spy.mockRestore();
  });

  it("propagates getContext() throw when context not set", async () => {
    // If preAction doesn't run, getContext() throws
    const { getContext, resetContext: reset } = await import("../lib/context");
    reset();
    expect(() => getContext()).toThrow("Context not resolved");
  });
});

describe("whoami acceptance test", () => {
  it("exits 0 for whoami", async () => {
    await program.parseAsync(["node", "spacebase", "whoami"]);
    // if no throw, exit code was 0
  });
});
