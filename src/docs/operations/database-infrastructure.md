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

### When the disk is full

A managed PostgreSQL that runs out of disk is not stopped: the provider keeps it reachable and defaults every transaction to read-only, so an ordinary write fails with `cannot execute INSERT in a read-only transaction` while reads go on. Sovrium's scheduled sweeps — activity-log retention, table `retention`, the run-history sweep, the form-draft sweep and the webhook outbox purge — open their transaction read-write, which is the one write such a server allows, so they keep freeing space in that state. Each logs what it deleted every time it runs, zero included, and a sweep the server still refuses is logged with the table, the rows that were due and the refusal, then runs again at its next tick. The sweeps only delete what their windows already allow; growing the volume stays the operator's call.

## Embedded data directory

All local state lives under a single, relocatable data directory.

| Variable           | Default            | Description                                                                 |
| ------------------ | ------------------ | --------------------------------------------------------------------------- |
| `DATABASE_URL`     | _unset, so SQLite_ | Database engine and location selector.                                      |
| `SOVRIUM_DATA_DIR` | `./.sovrium`       | Root for the SQLite file, lock files, the encryption key and local storage. |

The default `./.sovrium/database.db` sits under that data directory; the parent directory is created automatically on first boot.

## Static page-render cache

Sovrium renders pages server-side on every request. For a page whose HTML does not depend on per-request state — a marketing, about or pricing page — that is wasted CPU. The in-memory render cache renders such a page once and serves it from memory on subsequent anonymous requests, skipping the render entirely. It is both smaller and faster, so it is on by default rather than being an eco lever you opt into.

| Variable                | Default | Options      | Description                                                                       |
| ----------------------- | ------- | ------------ | --------------------------------------------------------------------------------- |
| `ECO_PAGE_CACHE`        | `on`    | `on`, `off`  | In-memory cache of page HTML. Operators opt out; they never opt in.               |
| `ECO_PAGE_CACHE_MAX_MB` | `64`    | integer (MB) | Byte budget for the cached pages; past it, the least recently served are evicted. |

How it works:

- **Cacheability is derived, never authored** — as a three-way verdict. A page is `static` when its rendered HTML cannot vary by request. A page is `content` when its only out-of-schema input is a directory of markdown files: it owns a `contentDir` and trips nothing beyond `contentDir`, `markdown` and its own route parameter. Everything else is `dynamic` and never cached — a page with non-public access, a collection, a page or component data source, a file source, presence, an invitation page (`page.invitation`), a data-bound sidebar, a form that starts from `$query.<name>` or `$now` (its prefill, a field's default value, or the placing component's own prefill), a `$app.origin` reference, or a parameterised route with **no** `contentDir` behind it, since there is no corpus to measure and so nothing can prove its render invariant. The check reads the page as it renders, not only as it is written: it follows every component placed through `$ref` or `component`, at any depth, and every breakpoint's `responsive.<breakpoint>.children`. A component template whose only inputs are the vars its reference passes stays cacheable.
- **Safety model.** The cache is consulted only for **anonymous, non-preview** requests; session-dependent filtering is deterministic when no session exists, so one user's view can never leak to another.
- **Invalidation by checksum.** Each entry is keyed by the app's render checksum, the path and the language. The checksum covers the render-affecting slice of the config — pages, components, design, languages, analytics — so any schema edit changes every key and stale entries become unreachable. No time-to-live, no purge logic.
- **Content pages are keyed by their corpus too.** A `content` page extends that key with a checksum of its `contentDir`: the sorted path, modification time and size of every markdown file, re-scanned per request. Editing, adding or removing an article changes the checksum, so the next request misses and serves the new prose. Both modification time and size participate, so a same-millisecond rewrite of a different length is still caught. No watcher, no restart, no purge endpoint.
- **Bounded by bytes, not by entry count.** `ECO_PAGE_CACHE_MAX_MB` caps the cached pages at that many megabytes of UTF-8, and the cache keeps each page as exactly those bytes, so the figure you set is the size of what it holds. Past the budget, the pages served least recently are evicted until the new one fits: a page visitors keep coming back to stays cached while a crawler walks through the rest of the site. An entry larger than the whole budget is refused. Bytes are the right unit once whole documentation zones are cacheable: two hundred marketing pages and two hundred long-form articles differ by an order of magnitude. The budget bounds the cache, not the process: the JavaScript heap, the database and the rendering of each miss come on top of it — see **Running in a small container**.
- **Observability.** Every page response carries `X-Render-Cache: hit | miss | bypass` and a `Cache-Control` header — `public, max-age=300` for cacheable pages; `private, no-store` for an invitation page (`page.invitation`), whoever asks and whatever the cache setting, since each visit is answered from the token in its own address and no copy is kept anywhere; `public, no-cache` with a weak `ETag` for anonymous renders of pages that read table data, so a browser or CDN may keep the page but asks again on every visit, gets an empty `304 Not Modified` while nothing changed, and gets the new page on the visit after a write; `public, max-age=60, stale-while-revalidate=300` for anonymous renders of other non-cacheable paths, such as a parameterised route or a presence page that reads no table; and `private, no-cache` for authenticated or preview renders. Language variants are isolated by key.

**Ecoconception** documents the full `ECO_*` contract.

## Running in a small container

On Linux, the runtime sizes its JavaScript heap against the memory limit of the container or service it runs in, such as Docker's `--memory` or a systemd unit's `MemoryMax=`, rather than against the memory of the host. That limit covers the whole process, though, and the heap is only part of it: the database, the native buffers of uploads and responses, the binary itself and the page cache all count against the same figure.

Two settings keep a small instance inside its limit:

- **Size the page cache to the container.** `ECO_PAGE_CACHE_MAX_MB` defaults to `64`, which is a large share of a 512 MiB limit; on a small container, `16` or `32` keeps the cache useful without crowding the heap. The cache never grows past its budget, but the budget is counted inside the same limit as everything else.
- **Leave headroom for what is not heap.** `BUN_JSC_forceRAMSize`, set in the environment of the process, is the memory size in bytes the heap is sized against, in place of the limit. About three quarters of the limit (`402653184` under 512 MiB) makes the heap collect garbage earlier and leaves the rest to the database and the buffers.

| Variable                | Example     | Effect                                                                        |
| ----------------------- | ----------- | ----------------------------------------------------------------------------- |
| `ECO_PAGE_CACHE_MAX_MB` | `16`        | Byte budget of the page cache, in megabytes.                                  |
| `BUN_JSC_forceRAMSize`  | `402653184` | The memory size, in bytes, the heap is sized against. Set it below the limit. |

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
