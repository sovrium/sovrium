# Environment Variables: Project and Data Directories

> Where the engine reads your app from, and where it writes what running it produces. Both are environment, never schema: nothing about how an app is supervised belongs in the config, so a config authored under a supervisor runs unchanged in Docker, on a server, and in CI.

The variables in **Env Vars: Core** are values — a port, a URL, a connection string. The ones here are what a supervising process needs instead: the Sovrium desktop app, a systemd unit, a CI step. Four of the six are _paths_, and unset they resolve against the working directory, which is what a person typing `sovrium start` in their project folder wants. Every one of them is optional.

## Running under a supervisor

A supervisor knows which folder holds the app but does not get to choose the working directory the binary is launched from. These let it say so without a `cd`.

| Variable                          | Default                                   | Description                                                                                                         |
| --------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `SOVRIUM_PROJECT_DIR`             | unset (the working directory)             | The project root: where `start` and `build` look for a config, and the jail the whole config graph must stay inside |
| `SOVRIUM_CONFIG_FILE`             | unset (`app.yaml` → `app.yml` → `app.ts`) | The config file **within** that root, instead of probing for candidates                                             |
| `SOVRIUM_SHUTDOWN_ON_STDIN_CLOSE` | unset                                     | `1` makes end-of-file on stdin stop the server, the way a signal does                                               |
| `SOVRIUM_INSTALL_METHOD`          | detected                                  | How Sovrium was installed. `desktop` hands updating to the app — see **Admin & Maintenance**                        |

### The project directory

```bash
SOVRIUM_PROJECT_DIR=/srv/contact-book sovrium start
```

Sovrium **resolves** against that directory; it never `chdir`s into it. A working-directory change would be a process-global mutation that silently relocates every other relative path at once — a relative config argument, a relative `SOVRIUM_PUBLIC_DIR` — and whether it did so correctly would depend on the order those happened to be read.

Three consequences follow, and each one is the point.

**A path you pass still wins.** `SOVRIUM_PROJECT_DIR` moves where `start` and `build` _discover_ a config when you name none. `sovrium start ./other.yaml` loads `./other.yaml` relative to the working directory exactly as before, and so do `APP_SCHEMA_FILE` and `APP_SCHEMA`.

**`SOVRIUM_CONFIG_FILE` names a file inside the root, not a path out of it.** It replaces the candidate probe with one named file, because naming `staging.yaml` means that file, and a fallback to `app.yaml` would boot something you never asked for. A value resolving outside the project directory is refused before any file is read:

```console
$ SOVRIUM_PROJECT_DIR=/srv/app SOVRIUM_CONFIG_FILE=../secrets.yaml sovrium start
Error: SOVRIUM_CONFIG_FILE resolves outside the project directory

  SOVRIUM_CONFIG_FILE: ../secrets.yaml
  Project directory:   /srv/app

It names a config file within the project directory, so it must stay inside it.
To run a config elsewhere, point SOVRIUM_PROJECT_DIR at its folder.
```

**The whole config graph is jailed to the root — but only when you set one.** A `$ref` reaching outside is refused before the referenced file is opened, so a refused reference never discloses so much as its existence:

```console
$ SOVRIUM_PROJECT_DIR=/srv/app sovrium start
Using app.yaml (auto-discovered)
Error: Failed to parse YAML file: /srv/app/app.yaml

Details: $ref resolves outside the project directory: /srv/shared/tables.yaml
The project directory is /srv/app, and the whole config graph must stay inside it.
```

The jail exists only where something asked for it. Unset, the project directory falls back to the working directory, which is the right default for _resolving_ a path and the wrong one for _confining_ it: a config legitimately loaded from elsewhere — `sovrium start ../other/app.yaml` — pulls in `$ref`s from elsewhere too, and jailing against an implicit default would refuse every one of them. Handing over a folder is what declares that the folder is the whole of what the engine may read.

### Stopping on end-of-file

Windows has no `SIGTERM`, so a supervisor there has no portable way to ask a child to stop. Closing the child's stdin is the portable equivalent, and `SOVRIUM_SHUTDOWN_ON_STDIN_CLOSE=1` turns it into a stop request:

```text
23:19:30 [server] stdin closed — stopping
23:19:30 [server] stopped
```

That is the same graceful stop a signal runs — the lock file is removed, in-flight requests drain, and the process exits `0` — so an EOF stop is indistinguishable from a signal stop to whatever reads the exit code or the lock file afterwards. It **adds** a trigger rather than replacing one: `SIGINT` and `SIGTERM` keep working exactly as they do today.

It is opt-in, and it stays opt-in. A server is routinely launched with stdin already closed — `nohup`, a systemd unit, a CI step, `sovrium start &` — and an unconditional EOF handler would kill every one of those the instant it booted. Set it only from a supervisor that holds stdin open for as long as it wants the server alive.

## The data directory

Runtime artefacts live under one directory so a fresh project root stays clean.

| Variable           | Default      | Description                                                        |
| ------------------ | ------------ | ------------------------------------------------------------------ |
| `SOVRIUM_DATA_DIR` | `./.sovrium` | Base directory for runtime artefacts, resolved to an absolute path |
| `SOVRIUM_LOCK_DIR` | the data dir | Directory holding the server lock file                             |

```text
.sovrium/
  database.db    # SQLite default — DATABASE_URL overrides
  encryption-key # per-install root secret — SOVRIUM_ENCRYPTION_KEY overrides
  lock           # server PID and config hash — SOVRIUM_LOCK_DIR overrides
  storage/       # local file uploads — STORAGE_LOCAL_DIRECTORY overrides
```

`SOVRIUM_DATA_DIR` only moves the _fallback_ location. Each artefact keeps its own dedicated override, and that override always wins. The database URL is in **Env Vars: Core**; the storage directory is in **Env Vars: Services**.

A **relative** value is resolved against the project directory rather than against the working directory, so one `SOVRIUM_DATA_DIR=.sovrium` means a different folder under each project a supervisor opens — otherwise two apps opened from one shell would share a database. An absolute value is taken as given, and with no `SOVRIUM_PROJECT_DIR` set the project directory _is_ the working directory, so nothing that resolves today resolves differently.
