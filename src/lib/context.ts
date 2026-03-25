export interface ResolvedContext {
  token: string;
  baseUrl: string;
  projectId: string | undefined;
}

let current: ResolvedContext | undefined;

export function setContext(ctx: ResolvedContext): void { current = ctx; }

export function getContext(): ResolvedContext {
  if (!current) throw new Error("Context not resolved — preAction did not run");
  return current;
}

export function resetContext(): void { current = undefined; }
