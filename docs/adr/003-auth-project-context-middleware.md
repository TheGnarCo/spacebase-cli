# ADR 003: Auth and Project Context Middleware

## Status
Accepted (2026-03-24)

## Context
Every project-scoped command (`docs`, `artifacts`, `tags`, `runs`, `keys`, `clients`) requires two things before the handler can do any meaningful work: resolved auth credentials and a resolved project ID. Auth credentials come from `~/.config/spacebase/credentials.json` (or `SPACEBASE_API_KEY`). Project ID can originate from four different sources with a defined priority order.

Without a shared resolution layer, every handler would need to:
1. Load and validate credentials
2. Walk through the four project context sources in the correct priority order
3. Emit consistent error messages when context is missing
4. Thread the resolved values through to the API client

Duplicating this across 9+ command groups guarantees drift — handlers written later will handle edge cases differently, error messages will vary, and bugs fixed in one handler will not propagate to others.

## Decision
A Commander.js `preAction` hook registered on the root `program` object resolves auth credentials and project context before any command handler runs. The hook:

1. Reads declared flags from `optsWithGlobals()` on the triggering command (e.g., `--project`, `--verbose`, `--json`)
2. Loads credentials from `~/.config/spacebase/credentials.json` or falls back to `SPACEBASE_URL` / `SPACEBASE_API_KEY` env vars
3. Resolves project ID in priority order:
   1. `--project <id>` flag
   2. `SPACEBASE_PROJECT_ID` env var
   3. `.spacebase` dotfile (walks up from `process.cwd()` to filesystem root)
   4. Project ID returned by `GET /api/v1/me` for the loaded API key
4. Writes resolved values to a **module-level context singleton** (`src/lib/context.ts`) — not to Commander's opts object

### Context injection mechanism

Commander.js's `optsWithGlobals()` only returns values for flags declared with `.option()`. It does not support arbitrary runtime property injection. Therefore, resolved auth credentials and project context are stored on a **module-level mutable object** exported from `src/lib/context.ts`:

```typescript
// src/lib/context.ts
export interface ResolvedContext {
  apiKey: string;
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
```

Handlers call `getContext()` to access resolved values. Tests call `resetContext()` between cases to prevent cross-contamination. The `preAction` hook calls `setContext()` after successful resolution.

`GlobalOpts` (the TypeScript interface for declared CLI flags) remains a separate type used only for Commander's `optsWithGlobals()` return — it includes `json`, `verbose`, `project`, `url`, and `apiKey` (the raw flag values), not the resolved context.

### Help guard

The `preAction` hook must skip auth resolution when help output is requested. Commander.js fires `preAction` even for `--help`. The hook detects this by checking `actionCommand.args` and the presence of `--help` in `process.argv`, and returns early without resolving credentials. This ensures users without credentials can still view help text.

### Project context enforcement

Commands that do not require project context (e.g., `login`, `whoami`, `logout`) receive `projectId: undefined` from `getContext()` without error — the hook does not abort if project context is absent, only if auth credentials are absent. Project-scoped commands (e.g., `docs list`) must check `getContext().projectId` and emit a clear error if undefined: `No project context. Run 'spacebase link' or pass --project <id>.`

The `preAction` hook emits a clear, actionable error message to stderr and exits with code 1 when credentials cannot be resolved. This is the single point of failure for auth errors across the entire CLI.

## Consequences

### Positive
- Handlers receive pre-resolved context via `getContext()` — no boilerplate auth/project loading per command
- Single point of failure for auth errors — error message wording and exit code are consistent across all commands
- Project context resolution order is enforced in one place — no risk of handlers implementing the priority order differently
- `.spacebase` dotfile walk-up is tested once, not reimplemented per command
- Module singleton is trivially testable — `resetContext()` between test cases prevents state leaks

### Negative
- Module-level mutable state (`current`) introduces a singleton that must be reset in tests — `resetContext()` is the escape hatch
- `preAction` fires for every command invocation, including `--help` — the hook detects this via `process.argv` inspection and returns early
- Auth errors surface before the command executes, so a malformed command + missing auth will show an auth error rather than a usage error
- `ResolvedContext` and `GlobalOpts` are separate types that must be kept in sync — `preAction` bridges between them
- Async resolution (the `GET /api/v1/me` fallback) requires the `preAction` hook to be `async (thisCommand, actionCommand) => { ... }` — Commander.js v14 supports async hooks natively

## Alternatives Rejected

| Approach | Reason |
|----------|--------|
| Per-handler auth loading | Guarantees inconsistent error messages and resolution logic drift as the command count grows |
| Middleware wrapper function (HOF around handlers) | Achieves the same result but loses Commander.js's built-in hook ordering and requires every command registration to use the wrapper — easy to forget |
| Session tokens / cookie-based auth | Incompatible with CI and skill use cases; bearer token (`sw_...`) approach is simpler and stateless |
| Single shared module called at the top of each handler | Still requires every handler author to remember the call; `preAction` is structural enforcement rather than convention |
