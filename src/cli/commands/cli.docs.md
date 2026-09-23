# CLI Overview

> What the binary does, where it reads configuration from, the command surface at a glance, and how watch mode reloads a running server.

The CLI is the whole product surface of the self-hosted binary: it runs your app, manages its lifecycle, scaffolds and validates projects, and provisions the secrets and admin account a deployment needs.

Every invocation is a command, an optional config path, and flags. Anything else — ports, database, storage, AI — comes from the environment, never from a flag.

```bash
sovrium [command] [config] [flags]
```

If the first positional argument looks like a config file — it ends in `.json`, `.yaml`, `.yml`, `.ts` or `.mts`, or contains a `/` — `start` is assumed. `sovrium app.yaml` and `sovrium start app.yaml` are the same command.

## The commands

Each group has its own article. `sovrium --help` prints the same list, and `sovrium help` is its bare-word spelling.

- **Lifecycle** — `sovrium start`, `sovrium stop`, `sovrium restart`, `sovrium reload`.
- **Project** — `sovrium init`, `sovrium build`, `sovrium schema`, `sovrium validate`, `sovrium types`.
- **Migrating a database** — `sovrium migrate`.
- **Seeding data** — `sovrium seed`.
- **Validation & schema generation** — `sovrium validate`, `sovrium schema`, `sovrium design-system`.
- **Admin & maintenance** — `sovrium admin create`, `sovrium secret generate`, `sovrium secret adopt`, `sovrium update`.
- **Documentation** — `sovrium docs`, this manual.
- **AI clients** — `sovrium mcp --project <dir>` serves a project's configuration to an AI client over stdio, read-only; **Your Config over MCP** describes the four tools it exposes.
- **Flags & exit codes** — `sovrium --version` and `sovrium version` print the version; `sovrium --help` prints the summary.

Every command answers `--help` with its own usage text, and answering it is never a destructive act — `sovrium init --help` prints help rather than scaffolding into the working directory.

## Where the configuration comes from

Resolved in a fixed order; the first source that answers wins.

1. **The config path argument** — `sovrium start app.yaml`.
2. **`APP_SCHEMA_FILE`** — a path, for when a config is too large to pass inline.
3. **`APP_SCHEMA`** — the config itself, as inline JSON, inline YAML, or an `http(s)` URL to fetch.
4. **Auto-discovery** — `app.yaml`, then `app.yml`, then `app.ts`, inside the project directory. `SOVRIUM_CONFIG_FILE` replaces this probe with one named file.
5. **Nothing** — the command refuses, naming the directory it looked in and the three filenames it looked for.

Auto-discovery is deliberately last. Putting it ahead of the two variables would let a file that happens to sit in the folder silently override an invocation that named a config.

```bash
sovrium start app.yaml
sovrium start config.json
sovrium start app.ts

APP_SCHEMA='{"name":"my-app"}' sovrium start
APP_SCHEMA='name: my-app' sovrium start
APP_SCHEMA='https://example.com/app.yaml' sovrium start
```

Supported extensions are `.json`, `.yaml`, `.yml`, `.ts` and `.mts`. The format is detected by extension, not by content, so a YAML document saved as `.txt` is rejected rather than sniffed.

## Watch mode

`--watch` (or `-w`) makes `start` watch the configuration and reload the server when it changes. It is the only flag that changes how `start` runs.

```bash
sovrium start app.yaml --watch
```

The watch follows the whole configuration, not just the file you named. A split config — an `app.ts` importing modules under `config/`, or an `app.yaml` pulling files in through `$ref` — reloads when **any** of those files changes, at any depth. The watched set is re-derived after every reload, so a module or `$ref` you add is followed from then on and one you remove stops triggering. The startup line says how many linked files are being watched.

### What a save looks like

Most edits are swapped into the running server in place. The port never closes, a browser sitting on the page keeps its live-reload connection and is told to refresh, and the whole thing lands fast enough to feel instant. You get two lines instead of the startup banner:

```text
13:19:04 [watch] Config changed — reloading… (app.yaml)
13:19:04 [watch] Server reloaded in 142ms
```

Every line printed after the startup banner carries the local time it was written, so a terminal you come back to still says when each save happened.

Saves are debounced, so an editor that formats on save — writing the file twice in quick succession — still produces a single reload rather than two. A save that leaves the content identical, which is what a formatter usually does, reloads nothing at all.

### Changes that restart instead

Some parts of the configuration own things the server sets up once at boot: the database schema, background jobs, credentials, connected services. Changing one of them replaces the process rather than swapping in place, and the watcher names the key responsible:

```text
13:22:41 [watch] Config changed (tables) — full restart… (app.yaml)
```

The keys that restart are `tables`, `automations`, `auth`, `agents`, `connections`, `env`, `analytics` and `buckets`. Everything else swaps in place — pages, forms, design, languages, redirects, links, SEO metadata, and the app's own name, version and description.

**A bad edit never takes the server down.** If the reloaded configuration fails to parse, fails validation, or cannot produce a working server — a stylesheet that will not compile, for instance — the reload is abandoned, the error is printed, and the previous configuration keeps serving on the same port. Fix the file and save again to retry.
