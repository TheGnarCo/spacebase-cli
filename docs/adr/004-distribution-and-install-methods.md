# ADR 004: Distribution and Install Methods

## Status
Accepted (2026-03-24)

## Context
`spacebase-cli` serves three consumer profiles with different install expectations:

1. **Developers** — want `npx spacebase` for one-off use or `npm install -g` / `bun add -g` for persistent global installs
2. **CI/CD pipelines and Claude Code skills** — want deterministic installs via `npx` or pre-installed globals
3. **Non-developer team members** — may not have Node.js/bun installed; want a standalone binary they can download and run

The spec (issue #2) lists npm package as primary and standalone binary as optional. This ADR makes the install strategy explicit.

## Decision

### Primary: npm package (methods 1 + 2)
The CLI is published as an npm package with a `bin` field pointing to the compiled entry point:

```jsonc
// package.json
{
  "name": "spacebase-cli",
  "bin": { "spacebase": "./dist/index.js" }
}
```

This enables:
- `npx spacebase-cli` — zero-install one-off execution
- `npm install -g spacebase-cli` — global install via npm
- `bun add -g spacebase-cli` — global install via bun

The entry point (`dist/index.js`) is pre-compiled TypeScript, not raw `.ts`, so consumers do not need a TypeScript runtime.

### Optional: standalone binary (method 3)
A standalone binary is produced via `bun build --compile` for users without a Node.js or bun runtime:

```bash
bun build src/index.ts --compile --outfile spacebase
```

This produces a single self-contained executable (~50-80MB) that includes the bun runtime. Distribution options:
- GitHub Releases — attach per-platform binaries (darwin-arm64, darwin-x64, linux-x64)
- Manual download — `curl` one-liner in README

The standalone binary is a convenience distribution, not the canonical install. It is built from the same source and produces identical CLI behavior.

### Build scripts

```jsonc
{
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target node",
    "build:binary": "bun build src/index.ts --compile --outfile spacebase"
  }
}
```

## Consequences

### Positive
- npm/npx is the lowest-friction install for the primary audience (developers and skills)
- Global install works identically with both npm and bun
- Standalone binary removes the Node.js/bun prerequisite for non-developer users
- Single source, single build pipeline — binary is not a separate codebase
- GitHub Releases integration is standard and well-understood

### Negative
- Standalone binary is ~50-80MB due to bundled bun runtime — large for a CLI tool
- Per-platform binaries require CI matrix builds (darwin-arm64, darwin-x64, linux-x64 minimum)
- Two distribution channels means two surfaces to keep in sync on releases
- `bun build --compile` may have edge cases with native modules (not currently a concern since Commander.js is pure JS)

## Alternatives Rejected

| Approach | Reason |
|----------|--------|
| npm-only, no binary | Excludes non-developer users who lack Node.js/bun |
| Binary-only, no npm | Excludes the `npx` workflow that developers and skills depend on |
| Homebrew tap | Adds a third distribution channel to maintain; revisit if user demand emerges |
| Docker image | Over-engineered for a CLI tool; standalone binary serves the same portability need |
