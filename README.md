# spacebase-cli

A TypeScript CLI that wraps the Spacebase REST API, providing auth, project context, document sync, artifact management, and more.

## Install

Download the latest binary for your platform from [Releases](https://github.com/TheGnarCo/spacebase-cli/releases):

```bash
# macOS (Apple Silicon)
curl -sL https://github.com/TheGnarCo/spacebase-cli/releases/latest/download/spacebase-darwin-arm64 -o spacebase

# macOS (Intel)
curl -sL https://github.com/TheGnarCo/spacebase-cli/releases/latest/download/spacebase-darwin-x64 -o spacebase

# Linux (x64)
curl -sL https://github.com/TheGnarCo/spacebase-cli/releases/latest/download/spacebase-linux-x64 -o spacebase

chmod +x spacebase
```

Optionally move it to your `$PATH`:

```bash
mv spacebase /usr/local/bin/spacebase
```

The binary is fully self-contained — no Node, Bun, or other runtime required.

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

### Runs

| Command | Description |
|---------|-------------|
| `runs trigger` | Trigger an Ideate pipeline run |
| `runs status <runId>` | Get run status |
| `runs artifacts <runId> [--out <dir>]` | Download run output artifacts |
| `runs claim <runId>` | Claim a run for processing |
| `runs sources <runId> [--out <dir>]` | Download source artifacts for a run |
| `runs upload <runId> <file> [--type] [--title]` | Upload a generated artifact to a run |
| `runs update <runId> --status <s> [--error <msg>]` | Update run status |

### Admin Commands

| Command | Description |
|---------|-------------|
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

## Usage from a Claude Code Skill or CI

Download and cache the binary on first run:

```bash
SPACEBASE="${XDG_CACHE_HOME:-$HOME/.cache}/spacebase"
if [ ! -f "$SPACEBASE" ]; then
  curl -sL https://github.com/TheGnarCo/spacebase-cli/releases/latest/download/spacebase-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/aarch64/arm64/;s/x86_64/x64/') -o "$SPACEBASE"
  chmod +x "$SPACEBASE"
fi
```

Then use env vars for non-interactive auth:

```bash
export SPACEBASE_API_KEY="sw_..."
export SPACEBASE_PROJECT_ID="<project-id>"
"$SPACEBASE" docs list --json
```

## Releasing

Every push to `main` automatically bumps the patch version, builds binaries, and publishes a new GitHub Release.

To release a specific version manually:

```bash
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
```

Binaries are built for macOS (ARM64, x64) and Linux (x64).

## Development

Requires [Bun](https://bun.sh/) v1.0+.

```bash
bun install          # install dependencies
bun run dev          # run from source (no build step)
bun run build        # compile standalone binary → ./spacebase
bun test             # run all tests
bun test <file>      # run a single test file
```
