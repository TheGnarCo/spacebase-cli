# ADR 002: Centralized Output Layer

## Status
Accepted (2026-03-24)

## Context
`spacebase-cli` serves two distinct consumers simultaneously: human users reading tables in a terminal (TTY) and a Claude Code skill invoking commands programmatically via bash and parsing stdout. These consumers have fundamentally different output needs — humans want formatted tables, colors, and readable prose; machine consumers need stable, parseable JSON with no extra noise.

If handlers call `console.log` directly, each author must independently decide what format to emit, check `--json` flags, and avoid writing debug output to stdout. This produces inconsistent behavior across the 9+ command groups, makes testing brittle (assertions depend on string formatting), and risks polluting stdout with table decorations that break skill-side JSON parsing.

Additionally, `process.stdout.isTTY` is false when output is piped — a property callers cannot override. Any output library must handle both the explicit `--json` flag and this implicit piped-output signal.

## Decision
All handler output routes through a centralized `output.ts` module. No handler may call `console.log`, `console.table`, `process.stdout.write`, or similar directly. The module exposes two primary functions:

- `output.json(data: unknown): void` — serializes `data` to pretty-printed JSON and writes to stdout
- `output.table(data: unknown[], columns: ColumnDef[]): void` — renders a human-readable table in TTY mode; falls back to `output.json(data)` in JSON mode

JSON mode is active when either of the following is true:
- The `--json` global flag is set
- `!process.stdout.isTTY` (stdout is piped)

`output.ts` reads the resolved output mode from `GlobalOpts` (populated by the `preAction` hook — see ADR 003) rather than inspecting flags directly, so the mode decision is made once per invocation.

Error output uses `console.error` to stderr exclusively, keeping stdout clean for machine consumers.

## Consequences

### Positive
- Consistent format across all commands — skill callers get reliable JSON regardless of which subcommand they invoke
- Easy test coverage via output capture — tests can replace `output.json` and `output.table` with stubs without spawning subprocesses
- No accidental stderr pollution from debug `console.log` calls in handlers
- TTY detection is centralized — adding a new output format (e.g., CSV) requires a single change in `output.ts`, not touches to every handler
- `--json` and piped-output behavior are guaranteed equivalent, preventing subtle differences between interactive and CI use

### Negative
- Authors must import and use `output.ts` rather than the familiar `console.log` — adds one line of convention to internalize
- `ColumnDef` type must be kept current as data shapes evolve; stale column definitions produce incomplete tables
- No built-in pagination or streaming support — large result sets render fully before any output appears

## Alternatives Rejected

| Approach | Reason |
|----------|--------|
| Direct `console.log` in handlers | Each handler independently decides format; inconsistency guaranteed as the codebase grows |
| Framework-level output (e.g., Oclif table plugin) | Adds runtime dependencies and couples output format to framework choice; incompatible with the Commander.js decision (ADR 001) |
| Per-command `--json` flags | Duplicates the flag across every command; `optsWithGlobals()` already surfaces a single root-level flag cleanly |
