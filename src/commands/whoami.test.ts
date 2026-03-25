import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { resetContext } from "../lib/context";
import { output } from "../lib/output";
import { program } from "../cli";

const TEST_TOKEN = "sw_testkey1234";

beforeEach(() => {
  resetContext();
  output.configure({ json: false });
  process.env.SPACEBASE_API_KEY = TEST_TOKEN;
});

afterEach(() => {
  resetContext();
  output.configure({ json: false });
  delete process.env.SPACEBASE_API_KEY;
});

describe("whoamiCommand handler", () => {
  it("masks token in table output (no --json flag)", async () => {
    const spy = spyOn(output, "table");
    await program.parseAsync(["node", "spacebase", "whoami"]);
    const calls = spy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1] as [Array<Record<string, string>>, unknown[]];
    expect(lastCall[0][0].token).toBe("sw_...1234");
    spy.mockRestore();
  });

  it("shows full token in JSON mode", async () => {
    const spy = spyOn(output, "table");
    await program.parseAsync(["node", "spacebase", "--json", "whoami"]);
    const calls = spy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1] as [Array<Record<string, string>>, unknown[]];
    expect(lastCall[0][0].token).toBe(TEST_TOKEN);
    spy.mockRestore();
  });

  it("shows (none) for projectId when not resolved", async () => {
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
    const { getContext, resetContext: reset } = await import("../lib/context");
    reset();
    expect(() => getContext()).toThrow("Context not resolved");
  });
});

describe("whoami acceptance test", () => {
  it("exits 0 for whoami", async () => {
    await program.parseAsync(["node", "spacebase", "whoami"]);
  });
});
