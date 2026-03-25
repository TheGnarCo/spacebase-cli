# ADR 001: CLI Framework Selection — Commander.js v14

## Status
Accepted (2026-03-24)

## Context
`spacebase-cli` is a TypeScript CLI wrapping the Spacebase REST API. It must serve two consumers: human users typing in a terminal and a Claude Code skill invoking commands programmatically via bash. The framework choice determines how reliably exit codes, stdout/stderr separation, `--json` output, and cross-cutting concerns (auth, project context) can be enforced across 9+ command groups.

A brainstorm evaluated 7 frameworks: Commander.js, CrustJS, Citty, Clipanion, Oclif, Yargs, and Clerc. The team unanimously (6/6) selected Commander.js.

## Decision
Use **Commander.js v14** as the CLI framework with:
- Root-level `--json`, `--verbose`, `--project` options accessed via `optsWithGlobals()`
- A `preAction` hook for shared auth/project context/output mode middleware
- A centralized `output.ts` utility (never `console.log` directly in handlers)
- `exitOverride()` enabled in tests for subprocess-free assertions
- A shared `GlobalOpts` TypeScript interface cast once per handler

## Consequences

### Positive
- Zero runtime dependencies
- 331M weekly downloads, 15 years of production history — lowest abandonment risk
- `exitOverride()` + `configureOutput()` provide documented, testable framework seams
- `showSuggestionAfterError()` provides free typo recovery for human users
- Universal developer familiarity — near-zero onboarding cost
- Full stdout/stderr control for reliable skill invocation

### Negative
- `opts: any` at handler boundary — requires manual `GlobalOpts` casting per handler
- No compile-time enforcement of cross-cutting flag usage (convention-based, not structural)
- SKILL.md must be hand-maintained as commands are added
- No built-in `--json` mode (centralized `output.ts` mitigates this)
- No built-in interactive prompts (external library needed for `login` command)

### Risks Accepted
- `optsWithGlobals()` behavior at 3+ nesting depth is convention-tested, not compile-time guaranteed
- Skill file drift is mitigated by a `bun run skill:check` CI step, not by structural generation

## Alternatives Rejected

| Framework | Reason |
|-----------|--------|
| CrustJS v0.0.15-alpha | No public source repo, 576 downloads, 40-day age — supply chain risk unacceptable |
| Citty v0.2.1 | Exit codes limited to 0/1, no preAction hook, UnJS-internal adoption |
| Clipanion v4.0.0-rc.4 | Forces class-based patterns, RC stalled 20 months, requires class hierarchy for shared flags |
| Oclif v4.10.2 | 14 runtime deps, class-based, file discovery breaks with bun build --compile |
| Yargs v18.0.0 | 5+ deps, type inference degrades at depth, bun argv friction |
| Clerc v1.3.1 | Startup network requests, thin adoption, opaque core |

## Follow-up Items
- Extract CrustJS `@crustjs/skills` concept into standalone build script for Commander
- Monitor Citty as fallback if Commander's `opts: any` proves worse than expected at scale
