import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { setContext, resetContext } from "./context";

const TEST_CONTEXT = {
  apiKey: "sw_testkey1234",
  baseUrl: "https://spacebase.thegnar.com",
  projectId: undefined,
};

function makeFetchResponse(status: number, body: unknown, statusText = "OK"): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  setContext(TEST_CONTEXT);
});

afterEach(() => {
  resetContext();
  mock.restore();
});

describe("ApiError", () => {
  it("is an instance of Error", async () => {
    const { ApiError } = await import("./http");
    const err = new ApiError(404, "Not Found", { message: "gone" });
    expect(err).toBeInstanceOf(Error);
  });

  it("has status, statusText, and body properties", async () => {
    const { ApiError } = await import("./http");
    const err = new ApiError(422, "Unprocessable Entity", { errors: ["bad"] });
    expect(err.status).toBe(422);
    expect(err.statusText).toBe("Unprocessable Entity");
    expect(err.body).toEqual({ errors: ["bad"] });
  });

  it("message includes status and statusText", async () => {
    const { ApiError } = await import("./http");
    const err = new ApiError(500, "Internal Server Error", null);
    expect(err.message).toContain("500");
    expect(err.message).toContain("Internal Server Error");
  });
});

describe("apiFetch", () => {
  it("prepends baseUrl to path", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      makeFetchResponse(200, { ok: true })
    );
    const { apiFetch } = await import("./http");
    await apiFetch("/api/v1/me");
    const [calledUrl] = fetchSpy.mock.calls[0] as [string, RequestInit?];
    expect(calledUrl).toBe("https://spacebase.thegnar.com/api/v1/me");
    fetchSpy.mockRestore();
  });

  it("injects Authorization: Bearer header", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      makeFetchResponse(200, { ok: true })
    );
    const { apiFetch } = await import("./http");
    await apiFetch("/api/v1/me");
    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit?];
    const headers = new Headers(opts?.headers);
    expect(headers.get("Authorization")).toBe("Bearer sw_testkey1234");
    fetchSpy.mockRestore();
  });

  it("injects Content-Type: application/json header when not set", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      makeFetchResponse(200, { ok: true })
    );
    const { apiFetch } = await import("./http");
    await apiFetch("/api/v1/me");
    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit?];
    const headers = new Headers(opts?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    fetchSpy.mockRestore();
  });

  it("does not override caller-supplied Content-Type", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      makeFetchResponse(200, { ok: true })
    );
    const { apiFetch } = await import("./http");
    await apiFetch("/api/v1/me", {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit?];
    const headers = new Headers(opts?.headers);
    expect(headers.get("Content-Type")).toBe("multipart/form-data");
    fetchSpy.mockRestore();
  });

  it("returns Response on 2xx", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      makeFetchResponse(200, { ok: true })
    );
    const { apiFetch } = await import("./http");
    const res = await apiFetch("/api/v1/me");
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    fetchSpy.mockRestore();
  });

  it("throws ApiError on 4xx response", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      makeFetchResponse(401, { message: "Unauthorized" }, "Unauthorized")
    );
    const { apiFetch, ApiError } = await import("./http");
    await expect(apiFetch("/api/v1/me")).rejects.toBeInstanceOf(ApiError);
    fetchSpy.mockRestore();
  });

  it("throws ApiError on 5xx response with correct status", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      makeFetchResponse(503, { message: "Service Unavailable" }, "Service Unavailable")
    );
    const { apiFetch, ApiError } = await import("./http");
    let caught: unknown;
    try {
      await apiFetch("/api/v1/me");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    const err = caught as import("./http").ApiError;
    expect(err.status).toBe(503);
    expect(err.statusText).toBe("Service Unavailable");
    expect(err.body).toEqual({ message: "Service Unavailable" });
    fetchSpy.mockRestore();
  });
});

describe("apiFetchJson", () => {
  it("returns parsed JSON from a 2xx response", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      makeFetchResponse(200, { id: "user_1", name: "Ada" })
    );
    const { apiFetchJson } = await import("./http");
    const data = await apiFetchJson<{ id: string; name: string }>("/api/v1/me");
    expect(data).toEqual({ id: "user_1", name: "Ada" });
    fetchSpy.mockRestore();
  });

  it("propagates ApiError on non-2xx", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      makeFetchResponse(403, { message: "Forbidden" }, "Forbidden")
    );
    const { apiFetchJson, ApiError } = await import("./http");
    await expect(apiFetchJson("/api/v1/me")).rejects.toBeInstanceOf(ApiError);
    fetchSpy.mockRestore();
  });
});

describe("verbose logging", () => {
  it("logs request and response to stderr when verbose=true", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      makeFetchResponse(200, { ok: true })
    );
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true);
    const { apiFetch } = await import("./http");
    await apiFetch("/api/v1/me", {}, true);
    const writes = stderrSpy.mock.calls.map((c) => String(c[0]));
    expect(writes.some((w) => w.includes("GET") && w.includes("/api/v1/me"))).toBe(true);
    expect(writes.some((w) => w.includes("200"))).toBe(true);
    fetchSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("does not log to stderr when verbose=false", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      makeFetchResponse(200, { ok: true })
    );
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true);
    const { apiFetch } = await import("./http");
    await apiFetch("/api/v1/me", {}, false);
    expect(stderrSpy.mock.calls.length).toBe(0);
    fetchSpy.mockRestore();
    stderrSpy.mockRestore();
  });
});
