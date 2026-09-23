# Database Infrastructure

> SQLite as the zero-config default, PostgreSQL through `DATABASE_URL`, the embedded data directory, the static page-render cache, and the standalone binary that bundles it all.

Sovrium runs on an embedded SQLite database with **zero configuration** and scales up to PostgreSQL by setting a single environment variable. The entire runtime — migrations, client bundles, the CSS engine, example configs — is bundled into one standalone binary, and a static page-render cache keeps server CPU down. This article documents the persistence and distribution layer that makes "run the binary, open the URL" possible.

## Zero-config SQLite default

When no `DATABASE_URL` is set, Sovrium resolves the SQLite dialect, creates `./.sovrium/database.db`, applies the SQLite migration set on first boot, and serves the full core surface — schema, auth, records CRUD, migrations and forms. The startup banner prints `Database: SQLite (<absolute path>)`.

This is a digital-sovereignty default, the twin of `STORAGE_PROVIDER` defaulting to local disk and `AI_PROVIDER` to a local model: the operator opts **into** a managed service, never the other way around.

## PostgreSQL when configured

Set `DATABASE_URL` to a `postgresql://` URL and Sovrium resolves the PostgreSQL dialect, connects, applies the PostgreSQL migration set, and prints `Database: PostgreSQL`. No SQLite file is created.

One variable decides, by scheme:

| `DATABASE_URL` value                      | Resolves to                                                          |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `postgres://…` or `postgresql://…`        | PostgreSQL at that URL.                                              |
| _unset or empty_                          | SQLite at `./.sovrium/database.db` — the zero-config default.        |
| `file:./x.db` or `file:/abs.db`           | SQLite at the resolved path.                                         |
| `sqlite:./x.db` or `sqlite:///abs.db`     | SQLite alias for the same on-disk file.                              |
| `:memory:`                                | Ephemeral SQLite — dialect-level only, not a full deployment target. |
| anything else (a bare path, `mysql://` …) | Throws `Unsupported DATABASE_URL scheme: …` at boot.                 |

A **bare filesystem path with no scheme** is rejected at boot rather than guessed at — prefix it with `file:`. The SQLite file location is chosen exclusively through `DATABASE_URL`.

The selected dialect drives the database client, the migration set, the authentication adapter, and the operator-facing `runtime` label the admin version endpoint reports.

### Graceful degradation

SQLite mode supports the core subset. Advanced PostgreSQL-only features — notably vector-backed semantic search — return a typed `501` with `requires-postgres` rather than crash. Scale up to PostgreSQL to unlock them; no config changes are required.

## Embedded data directory

All local state lives under a single, relocatable data directory.

| Variable           | Default            | Description                                                                 |
| ------------------ | ------------------ | --------------------------------------------------------------------------- |
| `DATABASE_URL`     | _unset, so SQLite_ | Database engine and location selector.                                      |
| `SOVRIUM_DATA_DIR` | `./.sovrium`       | Root for the SQLite file, lock files, the encryption key and local storage. |

The default `./.sovrium/database.db` sits under that data directory; the parent directory is created automatically on first boot.

## Static page-render cache

Sovrium renders pages server-side on every request. For a page whose HTML does not depend on per-request state — a marketing, about or pricing page — that is wasted CPU. The in-memory render cache renders such a page once and serves it from memory on subsequent anonymous requests, skipping the render entirely. It is both smaller and faster, so it is on by default rather than being an eco lever you opt into.

| Variable                | Default | Options      | Description                                                         |
| ----------------------- | ------- | ------------ | ------------------------------------------------------------------- |
| `ECO_PAGE_CACHE`        | `on`    | `on`, `off`  | In-memory cache of page HTML. Operators opt out; they never opt in. |
| `ECO_PAGE_CACHE_MAX_MB` | `64`    | integer (MB) | Memory budget before the oldest entries are evicted.                |

How it works:

- **Cacheability is derived, never authored** — as a three-way verdict. A page is `static` when its rendered HTML cannot vary by request. A page is `content` when its only out-of-schema input is a directory of markdown files: it owns a `contentDir` and trips nothing beyond `contentDir`, `markdown` and its own route parameter. Everything else is `dynamic` and never cached — a page with non-public access, a collection, a page or component data source, a file source, presence, a data-bound sidebar, or a parameterised route with **no** `contentDir` behind it, since there is no corpus to measure and so nothing can prove its render invariant.
- **Safety model.** The cache is consulted only for **anonymous, non-preview** requests; session-dependent filtering is deterministic when no session exists, so one user's view can never leak to another.
- **Invalidation by checksum.** Each entry is keyed by the app's render checksum, the path and the language. The checksum covers the render-affecting slice of the config — pages, components, design, languages, analytics — so any schema edit changes every key and stale entries become unreachable. No time-to-live, no purge logic.
- **Content pages are keyed by their corpus too.** A `content` page extends that key with a checksum of its `contentDir`: the sorted path, modification time and size of every markdown file, re-scanned per request. Editing, adding or removing an article changes the checksum, so the next request misses and serves the new prose. Both modification time and size participate, so a same-millisecond rewrite of a different length is still caught. No watcher, no restart, no purge endpoint.
- **Bounded by bytes, not by entry count.** `ECO_PAGE_CACHE_MAX_MB` caps the total HTML held; past the budget, the oldest entries are evicted until the new one fits, and an entry larger than the whole budget is refused. Bytes are the right unit once whole documentation zones are cacheable: two hundred marketing pages and two hundred long-form articles differ by an order of magnitude.
- **Observability.** Every page response carries `X-Render-Cache: hit | miss | bypass` and a `Cache-Control` header — `public, max-age=300` for cacheable pages, `public, max-age=60, stale-while-revalidate=300` for anonymous renders of non-cacheable paths, and `private, no-cache` for authenticated or preview renders. Language variants are isolated by key.

**Ecoconception** documents the full `ECO_*` contract.

## Standalone binary distribution

Sovrium's primary distribution channel is a **standalone binary** that runs with no Bun or Node.js on the target host. The binary embeds the entire runtime into a single executable:

- the CLI command surface;
- the migration sets for both dialects;
- client bundles and island chunks;
- the init templates, each carrying its own agent bundle, and the example configs;
- the themed CSS engine;
- this manual.

In compiled mode the binary reads its **embedded** assets, never a repository tree on disk — so it behaves identically when launched from any working directory. Embedded client bundles, island chunks and the language-switcher script are served over HTTP from the binary-launched server.

## Related reading

- **Installation** — getting the binary and running it.
- **Environment Variables** — the full reference, including `DATABASE_URL` and `SOVRIUM_DATA_DIR`.
- **Schema Migrations** — the migration sets each dialect applies.
- **Buckets Overview** — local and S3 storage, the `STORAGE_PROVIDER` twin.
- **Ecoconception** — the `ECO_PAGE_CACHE` contract and the wider posture.
