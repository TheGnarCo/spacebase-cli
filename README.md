# spacebase-cli

A TypeScript CLI that wraps the Spacebase REST API, providing auth, project context, document sync, artifact management, and more.

## Prerequisites

- [Bun](https://bun.sh/) v1.0+

## Install

```bash
git clone https://github.com/TheGnarCo/spacebase-cli.git
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

### Documents

| Command | Description |
|---------|-------------|
| `docs list` | List documents (metadata) |
| `docs get <docId>` | Get raw markdown content |
| `docs create <title> [--file <path>] [--folder <path>]` | Create a document |
| `docs update <docId> [--file <path>] [--title <t>] [--folder <p>]` | Update a document |
| `docs delete <docId>` | Delete a document |
| `docs lock <docId>` | Toggle lock on a document |
| `docs pull [dir]` | Sync all docs to a local directory |
| `docs push [dir]` | Push local changes back to the API |

### Artifacts

| Command | Description |
|---------|-------------|
| `artifacts list` | List artifacts with tags |
| `artifacts upload <file> [--tags <t1,t2>]` | Upload an artifact |
| `artifacts download <artifactId> [--out <path>]` | Download an artifact |
| `artifacts delete <artifactId>` | Delete an artifact |
| `artifacts tags <artifactId> [--set <t1,t2>]` | Get or set tags on an artifact |

### Other Commands

| Command | Description |
|---------|-------------|
| `tags list` | List all project tags |
| `runs trigger` | Trigger an Ideate pipeline run |
| `runs status <runId>` | Get run status |
| `runs artifacts <runId> [--out <dir>]` | Download run output artifacts |
| `keys list` | List API keys for project (admin/team) |
| `keys create <name>` | Create a new API key (admin/team) |
| `keys revoke <keyId>` | Revoke an API key (admin/team) |
| `clients list` | List clients (admin/team) |
| `clients get <clientId>` | Get client detail (admin/team) |

### Help

Every command supports `--help`. Run `spacebase help [command]` for details on any command or subcommand.

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
bunx github:TheGnarCo/spacebase-cli <command> [options]
```

Or with `npx` (still requires Bun on `$PATH`):

```bash
npx github:TheGnarCo/spacebase-cli <command> [options]
```

For CI or skill contexts, use env vars instead of interactive login:

```bash
export SPACEBASE_API_KEY="sw_..."          # project-scoped API key
export SPACEBASE_PROJECT_ID="<project-id>" # optional if key is project-scoped
bunx github:TheGnarCo/spacebase-cli docs list --json
```

## Development

```bash
bun install          # install dependencies
bun run dev          # run from source (no build step)
bun run build        # compile standalone binary → ./spacebase
bun test             # run all tests
bun test <file>      # run a single test file
```
