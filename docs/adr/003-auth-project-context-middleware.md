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

1. Reads `GlobalOpts` from `optsWithGlobals()` on the triggering command
2. Loads credentials from `~/.config/spacebase/credentials.json` or falls back to `SPACEBASE_API_KEY`
3. Resolves project ID in priority order:
   1. `--project <id>` flag
   2. `SPACEBASE_PROJECT_ID` env var
   3. `.spacebase` dotfile (walks up from `process.cwd()` to filesystem root)
   4. Project ID returned by `GET /api/v1/me` for the loaded API key
4. Attaches resolved credentials and project ID to a `GlobalOpts` object accessible to the handler via `command.optsWithGlobals<GlobalOpts>()`

Commands that do not require project context (e.g., `login`, `whoami`, `logout`) can call `opts.projectId` and receive `undefined` without error — the hook does not abort if project context is absent, only if auth credentials are absent.

The `preAction` hook emits a clear, actionable error message to stderr and exits with code 1 when credentials cannot be resolved. This is the single point of failure for auth errors across the entire CLI.

## Consequences

### Positive
- Handlers receive pre-resolved context — no boilerplate auth/project loading per command
- Single point of failure for auth errors — error message wording and exit code are consistent across all commands
- Project context resolution order is enforced in one place — no risk of handlers implementing the priority order differently
- `.spacebase` dotfile walk-up is tested once, not reimplemented per command
- `preAction` runs synchronously before the handler, so handlers can treat `opts.apiKey` and `opts.projectId` as guaranteed non-null (for project-scoped commands)

### Negative
- `preAction` fires for every command invocation, including `--help` — the hook must guard against running when help output is triggered
- Auth errors surface before the command executes, so a malformed command + missing auth will show an auth error rather than a usage error — the hook must skip resolution when `--help` is present
- `GlobalOpts` grows as cross-cutting concerns are added; the interface must be kept in sync with what `preAction` actually resolves
- Async resolution (the `GET /api/v1/me` fallback) requires the `preAction` hook to be async — Commander.js supports this but it must be consistently awaited

## Alternatives Rejected

| Approach | Reason |
|----------|--------|
| Per-handler auth loading | Guarantees inconsistent error messages and resolution logic drift as the command count grows |
| Middleware wrapper function (HOF around handlers) | Achieves the same result but loses Commander.js's built-in hook ordering and requires every command registration to use the wrapper — easy to forget |
| Session tokens / cookie-based auth | Incompatible with CI and skill use cases; bearer token (`sw_...`) approach is simpler and stateless |
| Single shared module called at the top of each handler | Still requires every handler author to remember the call; `preAction` is structural enforcement rather than convention |
