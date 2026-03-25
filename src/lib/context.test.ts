import { describe, it, expect, beforeEach } from "bun:test";
import { setContext, getContext, resetContext } from "./context";

beforeEach(() => {
  resetContext();
});

describe("context singleton", () => {
  it("throws before setContext is called", () => {
    expect(() => getContext()).toThrow("Context not resolved — preAction did not run");
  });

  it("returns the context after setContext", () => {
    const ctx = { token: "sw_test", baseUrl: "https://example.com", projectId: undefined };
    setContext(ctx);
    expect(getContext()).toEqual(ctx);
  });

  it("returns context with a projectId", () => {
    const ctx = { token: "sw_abc", baseUrl: "https://spacebase.thegnar.com", projectId: "proj_123" };
    setContext(ctx);
    expect(getContext().projectId).toBe("proj_123");
  });

  it("resetContext clears state so getContext throws again", () => {
    setContext({ token: "sw_test", baseUrl: "https://example.com", projectId: undefined });
    expect(() => getContext()).not.toThrow();
    resetContext();
    expect(() => getContext()).toThrow();
  });

  it("setContext overwrites previous context", () => {
    setContext({ token: "sw_first", baseUrl: "https://a.com", projectId: undefined });
    setContext({ token: "sw_second", baseUrl: "https://b.com", projectId: "proj_x" });
    expect(getContext().token).toBe("sw_second");
  });
});
