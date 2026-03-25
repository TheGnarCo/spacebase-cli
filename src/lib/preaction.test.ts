import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import { resetContext, getContext } from "./context";
import { output } from "./output";

// We import after mocking dependencies below
let runPreAction: (opts: import("../cli").GlobalOpts) => Promise<void>;

const defaultOpts = {
  json: false,
  verbose: false,
  project: undefined,
  url: undefined,
  apiKey: undefined,
};

describe("runPreAction", () => {
  beforeEach(async () => {
    resetContext();
    output.configure({ json: false });
    // Re-import to pick up fresh mocks; use dynamic import per test group
  });

  describe("help guard", () => {
    it("returns early without loading credentials when --help is in argv", async () => {
      const orig = process.argv;
      process.argv = ["node", "spacebase", "--help"];
      try {
        // Mock loadCredentials to track calls
        const authMod = await import("./auth");
        const loadSpy = spyOn(authMod, "loadCredentials").mockResolvedValue(undefined);

        const { runPreAction } = await import("./preaction");
        await runPreAction(defaultOpts);

        expect(loadSpy).not.toHaveBeenCalled();
      } finally {
        process.argv = orig;
        mock.restore();
      }
    });

    it("returns early without loading credentials when -h is in argv", async () => {
      const orig = process.argv;
      process.argv = ["node", "spacebase", "-h"];
      try {
        const authMod = await import("./auth");
        const loadSpy = spyOn(authMod, "loadCredentials").mockResolvedValue(undefined);

        const { runPreAction } = await import("./preaction");
        await runPreAction(defaultOpts);

        expect(loadSpy).not.toHaveBeenCalled();
      } finally {
        process.argv = orig;
        mock.restore();
      }
    });
  });

  describe("missing credentials", () => {
    it("calls output.error and process.exit(1) when credentials are undefined", async () => {
      const orig = process.argv;
      process.argv = ["node", "spacebase", "whoami"];
      try {
        const authMod = await import("./auth");
        spyOn(authMod, "loadCredentials").mockResolvedValue(undefined);

        const errorSpy = spyOn(output, "error").mockImplementation(() => {});
        const exitSpy = spyOn(process, "exit").mockImplementation((() => {
          throw new Error("process.exit(1)");
        }) as never);

        const { runPreAction } = await import("./preaction");

        await expect(runPreAction(defaultOpts)).rejects.toThrow("process.exit(1)");
        expect(errorSpy).toHaveBeenCalledWith(
          "Not authenticated. Run 'spacebase login' or set SPACEBASE_API_KEY."
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
      } finally {
        process.argv = orig;
        mock.restore();
      }
    });
  });

  describe("successful resolution", () => {
    it("calls setContext with resolved credentials and project ID", async () => {
      const orig = process.argv;
      process.argv = ["node", "spacebase", "whoami"];
      try {
        const authMod = await import("./auth");
        spyOn(authMod, "loadCredentials").mockResolvedValue({
          token: "sw_test_key",
          baseUrl: "https://example.com",
        });
        spyOn(authMod, "resolveProjectId").mockResolvedValue("proj_123");

        const { runPreAction } = await import("./preaction");
        await runPreAction(defaultOpts);

        const ctx = getContext();
        expect(ctx.token).toBe("sw_test_key");
        expect(ctx.baseUrl).toBe("https://example.com");
        expect(ctx.projectId).toBe("proj_123");
      } finally {
        process.argv = orig;
        mock.restore();
      }
    });

    it("sets context with undefined projectId when none is resolved", async () => {
      const orig = process.argv;
      process.argv = ["node", "spacebase", "whoami"];
      try {
        const authMod = await import("./auth");
        spyOn(authMod, "loadCredentials").mockResolvedValue({
          token: "sw_test_key",
          baseUrl: "https://example.com",
        });
        spyOn(authMod, "resolveProjectId").mockResolvedValue(undefined);

        const { runPreAction } = await import("./preaction");
        await runPreAction(defaultOpts);

        const ctx = getContext();
        expect(ctx.projectId).toBeUndefined();
      } finally {
        process.argv = orig;
        mock.restore();
      }
    });
  });

  describe("auth-exempt commands", () => {
    it("skips auth check for link command", async () => {
      const orig = process.argv;
      process.argv = ["node", "spacebase", "link"];
      try {
        const authMod = await import("./auth");
        const loadSpy = spyOn(authMod, "loadCredentials").mockResolvedValue(undefined);

        const { runPreAction } = await import("./preaction");
        await expect(runPreAction(defaultOpts, "link")).resolves.toBeUndefined();

        expect(loadSpy).not.toHaveBeenCalled();
      } finally {
        process.argv = orig;
        mock.restore();
      }
    });
  });

  describe("output.configure", () => {
    it("configures json mode when opts.json is true", async () => {
      const orig = process.argv;
      process.argv = ["node", "spacebase", "whoami"];
      try {
        const authMod = await import("./auth");
        spyOn(authMod, "loadCredentials").mockResolvedValue({
          token: "sw_test_key",
          baseUrl: "https://example.com",
        });
        spyOn(authMod, "resolveProjectId").mockResolvedValue(undefined);

        const configureSpy = spyOn(output, "configure");

        const { runPreAction } = await import("./preaction");
        await runPreAction({ ...defaultOpts, json: true });

        expect(configureSpy).toHaveBeenCalledWith({ json: true });
      } finally {
        process.argv = orig;
        mock.restore();
      }
    });

    it("configures json mode based on TTY when opts.json is false", async () => {
      const orig = process.argv;
      process.argv = ["node", "spacebase", "whoami"];
      const origIsTTY = process.stdout.isTTY;
      try {
        const authMod = await import("./auth");
        spyOn(authMod, "loadCredentials").mockResolvedValue({
          token: "sw_test_key",
          baseUrl: "https://example.com",
        });
        spyOn(authMod, "resolveProjectId").mockResolvedValue(undefined);

        // Simulate non-TTY (piped) environment
        Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });

        const configureSpy = spyOn(output, "configure");

        const { runPreAction } = await import("./preaction");
        await runPreAction({ ...defaultOpts, json: false });

        expect(configureSpy).toHaveBeenCalledWith({ json: true });
      } finally {
        process.argv = orig;
        Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true });
        mock.restore();
      }
    });
  });
});
