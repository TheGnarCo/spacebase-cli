# spacebase-cli

A TypeScript CLI that wraps the Spacebase REST API, providing auth, project context, document sync, artifact management, and more.

## Prerequisites

- [Bun](https://bun.sh/) v1.0+

## Install

```bash
git clone <repo-url>
cd spacebase-cli
bun install
```

## Running (without publishing to npm)

### Development mode

Run directly from source via Bun — no build step needed:

```bash
bun run dev -- <command> [options]
```

For example:

```bash
bun run dev -- login
bun run dev -- docs list --project abc123
```

### Compiled binary

Build a standalone executable and run it directly:

```bash
bun run build        # produces ./spacebase
./spacebase <command> [options]
```

Optionally, move it somewhere on your `$PATH` for global access:

```bash
cp ./spacebase /usr/local/bin/spacebase
spacebase whoami
```

### Link locally with Bun

If `package.json` has a `bin` field configured, you can link the package globally without publishing:

```bash
bun link
```

This makes the `spacebase` command available system-wide for the current user.

## Usage

```
spacebase <command> [options]
```

### Auth

| Command | Description |
|---------|-------------|
| `login` | Authenticate with username/password (stores session token) |
| `logout` | Clear stored credentials |
| `whoami` | Show the current authenticated user |

### Project Context

| Command | Description |
|---------|-------------|
| `link <project-id>` | Bind the current directory to a project (writes `.spacebase`) |
| `unlink` | Remove the project binding |

Project ID is resolved in this order:

1. `--project <id>` flag
2. `SPACEBASE_PROJECT_ID` env var
3. `.spacebase` dotfile (walks up from CWD)
4. Project ID from API key via `GET /api/v1/me`

### Commands

| Command | Description |
|---------|-------------|
| `docs list\|get\|create\|update\|delete\|pull\|push` | Document CRUD and sync |
| `artifacts list\|get\|upload\|download` | File upload/download with tagging |
| `tags list` | List project tags |
| `runs trigger\|status\|artifacts` | Ideate pipeline management |
| `keys list\|create\|revoke` | API key management (admin/team) |
| `clients list\|get` | Client listing (admin/team) |

### Global Options

| Option | Description |
|--------|-------------|
| `--project <id>` | Override project context |
| `--api-key <key>` | Use an API key instead of session auth |
| `--json` | Machine-readable JSON output (auto-enabled when piped) |
| `--verbose` | Show request/response debug info |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SPACEBASE_URL` | API base URL (default: `https://spacebase.thegnar.com`) |
| `SPACEBASE_API_KEY` | API key for CI / non-interactive use |
| `SPACEBASE_PROJECT_ID` | Default project ID |

## Running without cloning (e.g. from a Claude Code Skill)

If you don't have the repo locally, you can run `spacebase` directly from the git URL using `bunx`:

```bash
bunx github:<org>/spacebase-cli <command> [options]
```

Or with `npx` (still requires Bun on `$PATH`):

```bash
npx github:<org>/spacebase-cli <command> [options]
```

For CI or skill contexts, use env vars instead of interactive login:

```bash
export SPACEBASE_API_KEY="sw_..."          # project-scoped API key
export SPACEBASE_PROJECT_ID="<project-id>" # optional if key is project-scoped
bunx github:<org>/spacebase-cli docs list --json
```

## Testing

```bash
bun test             # run all tests
bun test <file>      # run a single test file
```
