# Troubleshooting: Startup & Config

> The errors Sovrium prints when it will not start — port conflicts, a stale lock, an unusable DATABASE_URL, validation failures, an unwritable data directory, and unreadable config files.

The errors you are most likely to meet between typing `sovrium start` and seeing a URL. Every entry quotes the **real message**, so you can match what is in your terminal.

Stuck on a config? Run `sovrium validate <config>` first — it checks the file on its own and needs nothing else running.

## The server started on a different port

```text
13:19:04 Warning: [server] Port 3000 in use; using an OS-assigned port (see URL below).
```

Another process holds the port, so Sovrium takes a free one rather than failing. Read the URL in the startup banner, or pick a port yourself:

```bash
PORT=4000 sovrium start app.yaml
```

An out-of-range `PORT` is rejected outright:

```text
Error: Invalid port number "99999". Must be between 0 and 65535 (0 = auto-select).
```

## "Server already running"

```text
Error: Server already running (PID: 12345, port: 3000)
```

An instance is already up — Sovrium tracks it with a lock file. Stop it with `sovrium stop`.

A lock left by a crashed process, whose PID is gone, is detected and removed automatically, so this only blocks you when an instance really is running.

## "Unsupported DATABASE_URL scheme"

```text
Unsupported DATABASE_URL scheme: "./data/app.db". Use postgres://, postgresql://,
file:, sqlite:, or :memory:. A bare filesystem path is not accepted — prefix it
with file: (e.g. file:./database.db).
```

`DATABASE_URL` is set to something unrecognised — a bare filesystem path is the usual mistake. Three good answers:

- **Leave `DATABASE_URL` unset.** Sovrium uses an embedded SQLite database, no server required.
- **Point at a SQLite file** with the `file:` prefix — `file:./database.db`.
- **Use PostgreSQL** with a full URL — `postgres://user:password@localhost:5432/app`.

With no `DATABASE_URL`, tables and authentication work out of the box against a local file. Set the variable only to choose that file's location or to switch to PostgreSQL. See **Database Infrastructure**.

## "Sovrium refused this configuration" / "Error: Validation failed."

Every boot — and every `sovrium validate` and `sovrium build` — decodes your config against the same schema. `validate` prints the finding under `Error: Validation failed.`; `start` and `build` print the same finding under a line naming what did not happen:

```text
Error: Sovrium refused this configuration — nothing was started.

  Unknown property 'tag' on component type 'text'
    at pages[0].components[0]
    Accepted here: type, children, props, content, ..., element, required
```

The property you wrote is not one the schema declares at that spot. Check it against the accepted list, or move it under `props` if it is a raw HTML or ARIA attribute — `props` is forwarded to the browser untouched.

Structural problems that are not a stray key — a missing `name`, a number where a string belongs — still print as the decoder's indented tree. Read that one from the bottom: the top is schema machinery, and the final lines name the property and the reason (`is missing`, `is unexpected, expected: ...`).

**Nothing partial happens on a refusal.** No port is bound, no database is touched, no files are written. Fix the property and run again — or run `sovrium validate <config>` first, which asks the same question with no side effects at all. Full guide in **Validating a Config**.

## "Sovrium could not write its encryption key"

```text
Sovrium failed to start: Sovrium could not write its encryption key to
/srv/app/.sovrium/encryption-key (EACCES: permission denied). Point
SOVRIUM_DATA_DIR at a writable directory, or set SOVRIUM_ENCRYPTION_KEY so no
key needs to be written.
```

An unset `SOVRIUM_ENCRYPTION_KEY` is not an error — Sovrium generates a key on first start and keeps it in the data directory. This is the one case where it cannot: the directory is read-only, owned by another user, or blocked by a file sitting where a directory should be. The message names the exact path it tried. Either fix works:

```bash
SOVRIUM_DATA_DIR=/var/lib/sovrium   # a directory the process can write, or
SOVRIUM_ENCRYPTION_KEY=<64-hex>     # supply the key, and nothing is written
```

Sovrium refuses to start rather than fall back to a key held only in memory. Such a key works until the next restart, then leaves behind stored credentials nothing can decrypt — a failure that surfaces days later, inside somebody's integration.

The key is not a required variable. It is worth setting when the key and the data it protects do not live in the same place — an external database on a filesystem that resets, for instance. See **Environment Variables**.

## "File not found" or "No configuration provided"

```text
Error: File not found: app.yaml
```

The path does not exist — check the filename and directory. Two neighbours:

- `Error: No configuration provided` — no config path and no `APP_SCHEMA`. Pass a file: `sovrium start app.yaml`.
- `Error: Unsupported file format: .toml` — Sovrium reads `.json`, `.yaml`, `.yml` and `.ts`.

## "Failed to parse" your config

```text
Error: Failed to parse YAML file: app.yaml

Details: <the underlying parser error>
```

A syntax error. The classic cause is **tabs in a YAML file** — indentation must use spaces. Read the `Details:` line for the position, fix it, and re-run `sovrium validate app.yaml`. TypeScript configs report `Failed to load TypeScript config <path>` instead, followed by the compiler's own messages — a type or import error.

## Runtime failures

Auth key errors, SMTP warnings and MCP token refusals happen after the server is up. They are in **Troubleshooting: Auth, Email & MCP**.

## Related reading

- **Installation** — install and first run.
- **Environment Variables** — every variable Sovrium reads.
- **Lifecycle Commands** — `start`, `stop`, and the lock file.
- **Validating a Config** — reading a validation tree.
