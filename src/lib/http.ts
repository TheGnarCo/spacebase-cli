import { getContext } from "./context";

export class ApiError extends Error {
  status: number;
  statusText: string;
  body: unknown;

  constructor(status: number, statusText: string, body: unknown) {
    super(`API error ${status} ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  verbose = false
): Promise<Response> {
  const { apiKey, baseUrl } = getContext();
  const url = `${baseUrl}${path}`;
  const method = options.method ?? "GET";

  const callerHeaders = new Headers(options.headers);
  if (!callerHeaders.has("Content-Type")) {
    callerHeaders.set("Content-Type", "application/json");
  }
  callerHeaders.set("Authorization", `Bearer ${apiKey}`);

  if (verbose) {
    process.stderr.write(`-> ${method} ${path}\n`);
  }

  const response = await fetch(url, {
    ...options,
    headers: callerHeaders,
  });

  if (verbose) {
    process.stderr.write(`<- ${response.status} ${response.statusText}\n`);
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.clone().json();
    } catch {
      body = await response.clone().text();
    }
    throw new ApiError(response.status, response.statusText, body);
  }

  return response;
}

export async function apiFetchJson<T>(
  path: string,
  options: RequestInit = {},
  verbose = false
): Promise<T> {
  const response = await apiFetch(path, options, verbose);
  return response.json() as Promise<T>;
}

export async function apiFetchFormData<T>(
  path: string,
  form: FormData,
  verbose = false
): Promise<T> {
  const { apiKey, baseUrl } = getContext();
  const url = `${baseUrl}${path}`;

  if (verbose) {
    process.stderr.write(`-> POST ${path}\n`);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (verbose) {
    process.stderr.write(`<- ${response.status} ${response.statusText}\n`);
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.clone().json();
    } catch {
      body = await response.clone().text();
    }
    throw new ApiError(response.status, response.statusText, body);
  }

  return response.json() as Promise<T>;
}
