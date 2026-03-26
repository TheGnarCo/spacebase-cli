# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`spacebase-cli` is a standalone TypeScript CLI (`spacebase`) that wraps the Spacebase REST API. It replaces a set of bash scripts previously used by the `spacebase-api` Claude Code skill, providing proper auth, error handling, and a first-class terminal experience.

**Spec:** GitHub issue #2 is the canonical feature spec with full command reference, auth design, and acceptance criteria.

## Architecture

### Auth

- API-key-only auth via `spacebase link <api-key>` (validates key, stores credentials, writes `.spacebase` dotfile)
- Also supports `--api-key` flag or `SPACEBASE_API_KEY` env var (for CI)
- Credentials stored at `~/.config/spacebase/credentials.json` (or `$XDG_CONFIG_HOME`) with `0600` permissions
- Env var overrides: `SPACEBASE_URL`, `SPACEBASE_API_KEY` (for CI and skill use)

### Project Context Resolution (priority order)

1. `--project <id>` flag
2. `SPACEBASE_PROJECT_ID` env var
3. `.spacebase` dotfile (walks up from CWD)
4. Project ID from API key via `GET /api/v1/me`

### Command Groups

- `link <api-key>` / `unlink` — authenticate and bind directory to project (validates key, stores credentials, writes `.spacebase`)
- `whoami` — display current auth identity and project context
- `docs` — document CRUD + `pull`/`push` sync
- `artifacts` — file upload/download with tagging
- `tags` — project tag listing
- `runs` — Ideate pipeline trigger/status/artifacts + runner lifecycle (claim/sources/upload/update)
- `keys` — API key management (admin/team role required)
- `clients` — client listing (admin/team role required)

### Output Modes

- Human-friendly tables by default (TTY detected)
- `--json` for machine-readable output (auto-enabled when piped)
- `--verbose` for request/response debugging

## Build & Run

```bash
bun install          # install dependencies
bun run build        # compile standalone binary → ./spacebase
bun run dev          # run from source (no build step)
bun test             # run tests
bun test <file>      # run a single test file
```

## Distribution

Binaries are published as GitHub Release assets via `.github/workflows/release.yml`.
Tag a version (`git tag v0.1.0 && git push origin v0.1.0`) to trigger the build.
Consumers download the binary — no Node or Bun required at runtime.

## API Base URL

All API calls go to the configured instance URL (default: `https://spacebase.thegnar.com`). Endpoints follow the pattern:
- Auth: `/api/v1/me`
- Project-scoped: `/projects/{id}/docs`, `/projects/{id}/artifacts`, etc.
- Runs: `/runs/{id}`, `/runs/{id}/artifacts`
- Clients: `/clients`, `/clients/{id}`

## Conventions

- TypeScript, functional patterns, no classes unless the CLI framework requires them
- Package is `npx`-able and globally installable
- `.spacebase` files should be `.gitignore`d by consumers
