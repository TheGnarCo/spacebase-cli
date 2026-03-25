# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`spacebase-cli` is a standalone TypeScript CLI (`spacebase`) that wraps the Spacebase REST API. It replaces a set of bash scripts previously used by the `spacebase-api` Claude Code skill, providing proper auth, error handling, and a first-class terminal experience.

**Spec:** GitHub issue #2 is the canonical feature spec with full command reference, auth design, and acceptance criteria.

## Architecture

### Auth

- Uses project-scoped API bearer tokens (`sw_...`) exclusively (no session tokens)
- Credentials stored at `~/.config/spacebase/credentials.json` (or `$XDG_CONFIG_HOME`) with `0600` permissions
- Env var overrides: `SPACEBASE_URL`, `SPACEBASE_API_KEY` (for CI and skill use)

### Project Context Resolution (priority order)

1. `--project <id>` flag
2. `SPACEBASE_PROJECT_ID` env var
3. `.spacebase` dotfile (walks up from CWD)
4. Project ID from API key via `GET /api/v1/me`

### Command Groups

- `login` / `whoami` / `logout` — auth management
- `link` / `unlink` — directory-level project binding (`.spacebase` dotfile)
- `docs` — document CRUD + `pull`/`push` sync
- `artifacts` — file upload/download with tagging
- `tags` — project tag listing
- `runs` — Ideate pipeline trigger/status/artifacts
- `keys` — API key management (admin/team role required)
- `clients` — client listing (admin/team role required)

### Output Modes

- Human-friendly tables by default (TTY detected)
- `--json` for machine-readable output (auto-enabled when piped)
- `--verbose` for request/response debugging

## Build & Run

```bash
bun install
bun run build        # compile TypeScript
bun run dev          # development mode
bun test             # run tests
bun test <file>      # run a single test file
```

## API Base URL

All API calls go to the configured instance URL (default: `https://spacebase.thegnar.com`). Endpoints follow the pattern:
- Auth: `/api/v1/me`, `/api/v1/auth`
- Project-scoped: `/projects/{id}/docs`, `/projects/{id}/artifacts`, etc.
- Runs: `/runs/{id}`, `/runs/{id}/artifacts`
- Clients: `/clients`, `/clients/{id}`

## Conventions

- TypeScript, functional patterns, no classes unless the CLI framework requires them
- Package is `npx`-able and globally installable
- `.spacebase` files should be `.gitignore`d by consumers
