# ADR 004: Distribution and Install Methods

## Status
Accepted (2026-03-24)

## Context
`spacebase-cli` is an internal tool for The Gnar Company's Spacebase platform. Its consumers are:

1. **Developers** — run `spacebase` commands during local development and from Claude Code skills
2. **CI/CD pipelines** — need a deterministic, pre-installed binary
3. **Non-developer team members** — may not have Node.js/bun installed

The CLI will **not** be published to npm. Distribution is via compiled standalone binary and direct `bun run` for development.

## Decision

### Primary: standalone compiled binary
The CLI is distributed as a self-contained executable built with `bun build --compile`:

```bash
bun build src/index.ts --compile --outfile spacebase
```

This produces a single binary (~50-80MB) that includes the bun runtime. No Node.js or bun installation required to run it.

#### Distribution channels
- **GitHub Releases** — per-platform binaries attached to tagged releases (darwin-arm64, darwin-x64, linux-x64)
- **Direct download** — `curl` one-liner for install scripts and CI

#### Install patterns
```bash
# Download latest release (example for macOS ARM)
curl -fsSL https://github.com/TheGnarCo/spacebase-cli/releases/latest/download/spacebase-darwin-arm64 -o /usr/local/bin/spacebase
chmod +x /usr/local/bin/spacebase

# Or from a specific release
curl -fsSL https://github.com/TheGnarCo/spacebase-cli/releases/download/v1.0.0/spacebase-darwin-arm64 -o /usr/local/bin/spacebase
chmod +x /usr/local/bin/spacebase
```

### Development: direct bun execution
During development, the CLI runs directly via bun without compilation:

```bash
bun run src/index.ts         # run directly
bun run dev                  # alias via package.json scripts
```

### Optional: Homebrew tap
If user demand emerges, a Homebrew tap can wrap the GitHub Release binary:

```bash
brew install TheGnarCo/tap/spacebase
```

This is deferred — not implemented in the initial release.

### Build scripts

```jsonc
{
  "scripts": {
    "build": "bun build src/index.ts --compile --outfile spacebase",
    "dev": "bun run src/index.ts",
    "test": "bun test"
  }
}
```

## Consequences

### Positive
- Zero runtime dependencies for end users — binary is fully self-contained
- No npm account, publish pipeline, or registry maintenance needed
- GitHub Releases is the single source of truth for versioned binaries
- Claude Code skills can invoke the binary directly without `npx` overhead
- Development workflow uses native `bun run` — fast, no compilation step

### Negative
- Binary is ~50-80MB due to bundled bun runtime — larger than a typical CLI
- Per-platform binaries require CI matrix builds (darwin-arm64, darwin-x64, linux-x64 minimum)
- No `npx spacebase` one-liner — users must download and install the binary
- Updates require re-downloading the binary (no auto-update mechanism initially)

## Alternatives Rejected

| Approach | Reason |
|----------|--------|
| npm package (`npx` / `npm install -g`) | Not publishing to npm — this is an internal tool, and npm adds registry maintenance overhead for no benefit |
| Docker image | Over-engineered for a CLI tool; standalone binary serves the same portability need |
| `pkg` (Node.js compiler) | `bun build --compile` is native to our toolchain and produces smaller, faster binaries |
| `deno compile` | Would require porting the codebase from bun to deno runtime |
