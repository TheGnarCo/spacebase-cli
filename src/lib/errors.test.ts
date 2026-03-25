import { describe, expect, it, beforeEach, afterEach, spyOn } from "bun:test";
import { MissingProjectIdError, requireProjectId, wrapAction } from "./errors";
import { output } from "./output";

describe("MissingProjectIdError", () => {
  it("has the correct name and message", () => {
    const err = new MissingProjectIdError();
    expect(err.name).toBe("MissingProjectIdError");
    expect(err.message).toContain("Project ID is required");
  });
});

describe("requireProjectId", () => {
  it("does not throw when projectId is a string", () => {
    expect(() => requireProjectId("proj-123")).not.toThrow();
  });

  it("throws MissingProjectIdError when projectId is undefined", () => {
    expect(() => requireProjectId(undefined)).toThrow(MissingProjectIdError);
  });
});

describe("wrapAction", () => {
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    errorSpy = spyOn(output, "error");
    exitSpy = spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("catches MissingProjectIdError and exits", async () => {
    await wrapAction(async () => {
      throw new MissingProjectIdError();
    });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Project ID is required"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("re-throws other errors", async () => {
    await expect(
      wrapAction(async () => {
        throw new Error("something else");
      })
    ).rejects.toThrow("something else");
  });

  it("does nothing when action succeeds", async () => {
    await wrapAction(async () => {});
    expect(errorSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
