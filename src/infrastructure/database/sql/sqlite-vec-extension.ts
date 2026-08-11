/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * sqlite-vec native-extension loader (Phase 2 RAG acceleration, [internal ref]).
 *
 * Loads the `sqlite-vec` extension into a dedicated `bun:sqlite` connection so
 * RAG search can use a `vec0` ANN index (and FTS5 BM25 lexical candidates)
 * instead of the Phase 1 app-side cosine scan. Activation is gated entirely
 * behind the operator env var `RAG_SQLITE_VEC=on` — frugal-by-default, OFF
 * unless explicitly enabled.
 *
 * Settled premises (carry from the user story / Bun #30717):
 *
 *  - **Compiled binary blocked**: `bun build --compile` standalone binaries
 *    cannot load native SQLite extensions (Bun #30717). On the compiled binary
 *    this loader is a no-op + clear log — RAG silently falls back to app-side
 *    cosine (Phase 1), never crashing boot. `RAG_SQLITE_VEC_FORCE_UNAVAILABLE=1`
 *    simulates that constraint in tests without an actual compiled binary.
 *  - **macOS**: the system `libsqlite3` ships with extension loading disabled,
 *    so `Database.setCustomSQLite()` must point bun:sqlite at a build that
 *    enables it (Homebrew sqlite). `setCustomSQLite` is process-global + one-shot
 *    and must run BEFORE any `Database` is opened — so `primeSqliteVec()` runs
 *    from `db-bun.ts::buildClient` ahead of the primary connection. We try a
 *    direct `loadExtension` first and only reach for `setCustomSQLite` when the
 *    direct load is rejected.
 *
 *    ORDERING CAVEAT (the `setCustomSQLite` one-shot is best-effort, not
 *    guaranteed): `buildClient` is the FIRST `getDb()` consumer, but it is NOT
 *    necessarily the first `bun:sqlite Database` opened in the process. Boot runs
 *    `runMigrations` (`migrate.ts`, its own `new BunSqlite`) and DDL via
 *    `dialect-ddl.ts::openSqliteDdlDatabase` — both can open a Database before
 *    `getDb()` is ever called. If one of those opens first on a build whose
 *    bundled SQLite forbids `loadExtension` (the macOS-system-SQLite case), the
 *    later `setCustomSQLite` here throws "SQLite already loaded", which
 *    `loadWithCustomSqlite` catches → acceleration silently degrades to the
 *    Phase 1 app-side cosine path (documented fallback, never a crash). This is
 *    why acceleration is **not asserted** to be active in the E2E specs (the
 *    response contract is rank-equivalent across both paths, so VEC-002/003 pass
 *    either way): on a runtime where Bun's bundled SQLite already permits
 *    `loadExtension` directly (Linux/Docker — the production deploy target, and
 *    where the prebuilt `vec0` binaries are designed to load), `setCustomSQLite`
 *    is never needed and the migration-opens-first order is harmless. If a future
 *    change must guarantee acceleration on macOS-system-SQLite, hoist a single
 *    `setCustomSQLite` to the process entry point before ANY Database opens —
 *    do not rely on `primeSqliteVec` winning the race against migrations.
 *
 * The accelerated connection is a SECOND handle on the same SQLite file (WAL
 * mode permits concurrent readers); the primary drizzle connection keeps owning
 * writes to the canonical `system_ai_embeddings` BLOB table. The accelerated
 * search path reads that table through this handle and builds the `vec0` / FTS5
 * indexes on demand.
 */

import { existsSync } from 'node:fs'
import { Database as BunSqlite } from 'bun:sqlite'
import { getLoadablePath } from 'sqlite-vec'
import { resolveRagAcceleration } from '@/domain/services/rag/rag-acceleration'
import { logInfo, logWarning } from '@/infrastructure/logging/logger'
import { isCompiled } from '@/infrastructure/utils/package-paths'

/**
 * The sqlite-vec accelerated connection, or `undefined` when acceleration is
 * off / unavailable. Populated once by `primeSqliteVec()`.
 */
// eslint-disable-next-line functional/no-let -- module-level one-shot accelerated-connection memo
let accelerationClient: BunSqlite | undefined

/** Whether a prime attempt has already run (so it is exactly-once per process). */
// eslint-disable-next-line functional/no-let -- module-level one-shot resolution flag
let resolved = false

/**
 * Candidate custom-SQLite library paths for macOS, where the system build has
 * extension loading disabled. First existing path that enables `loadExtension`
 * wins. Linux/Docker Bun builds generally allow `loadExtension` directly, so the
 * direct attempt short-circuits this list there.
 */
const CUSTOM_SQLITE_CANDIDATES = [
  '/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib',
  '/usr/local/opt/sqlite/lib/libsqlite3.dylib',
] as const

/**
 * Open `dbPath` and load the `vec0` extension into it. Returns the connection on
 * success, or `undefined` (after closing it) when the load is rejected.
 */
const openAndLoad = (dbPath: string, extensionPath: string): BunSqlite | undefined => {
  const client = new BunSqlite(dbPath, { create: true })
  try {
    client.loadExtension(extensionPath)
    // eslint-disable-next-line functional/no-expression-statements -- match the primary connection's WAL + busy-timeout so the second handle reads concurrently
    client.exec('PRAGMA busy_timeout = 5000')
    return client
  } catch {
    try {
      client.close()
    } catch {
      // ignore close failures — the handle is being discarded regardless
    }
    return undefined
  }
}

/**
 * Re-point bun:sqlite at a custom SQLite build (first existing candidate) and
 * retry the extension load. `setCustomSQLite` is process-global + one-shot; a
 * "SQLite already loaded" rejection means a connection was already opened, in
 * which case the extension is simply unavailable and RAG falls back.
 */
const loadWithCustomSqlite = (dbPath: string, extensionPath: string): BunSqlite | undefined => {
  const candidate = CUSTOM_SQLITE_CANDIDATES.find((c) => existsSync(c))
  if (candidate === undefined) return undefined
  try {
    // eslint-disable-next-line functional/no-expression-statements -- process-global one-shot custom-SQLite selection
    BunSqlite.setCustomSQLite(candidate)
  } catch {
    return undefined
  }
  return openAndLoad(dbPath, extensionPath)
}

/**
 * Resolve the absolute path to the prebuilt `vec0` loadable extension for the
 * current platform. Returns `undefined` when the platform binary is missing
 * (unsupported arch / not installed) so the caller degrades to app-side cosine.
 */
const resolveLoadablePath = (): string | undefined => {
  try {
    return getLoadablePath()
  } catch {
    return undefined
  }
}

/**
 * Resolve the loadable-extension path when acceleration is both requested AND
 * possible on this runtime, logging the operator-facing fallback reason and
 * returning `undefined` otherwise. Covers: frugal-default OFF, the Bun #30717
 * compiled-binary / forced-unavailable guard, the in-memory database case, and
 * an unresolvable platform binary.
 */
const resolveAvailableExtensionPath = (dbPath: string): string | undefined => {
  if (!resolveRagAcceleration(process.env).sqliteVec) return undefined // frugal default: OFF

  // Bun #30717 guard: compiled binaries cannot load native extensions. The test
  // flag forces this branch without an actual `--compile` build.
  const forcedUnavailable = process.env['RAG_SQLITE_VEC_FORCE_UNAVAILABLE'] === '1'
  if (isCompiled || forcedUnavailable) {
    logInfo(
      'RAG_SQLITE_VEC=on requested but native SQLite extension loading is unavailable ' +
        `${isCompiled ? '(compiled binary, Bun #30717)' : '(RAG_SQLITE_VEC_FORCE_UNAVAILABLE=1)'} — ` +
        'falling back to app-side cosine (Phase 1).'
    )
    return undefined
  }

  if (dbPath === ':memory:') {
    // A second handle to `:memory:` is a different database, so the accelerated
    // index could never see the primary connection's rows — fall back.
    logWarning(
      'RAG_SQLITE_VEC=on requested on an in-memory SQLite database — acceleration needs a ' +
        'file-backed database; falling back to app-side cosine (Phase 1).'
    )
    return undefined
  }

  const extensionPath = resolveLoadablePath()
  if (extensionPath === undefined) {
    logWarning(
      'RAG_SQLITE_VEC=on requested but the sqlite-vec extension binary could not be resolved ' +
        '(unsupported platform or not installed) — falling back to app-side cosine (Phase 1).'
    )
  }
  return extensionPath
}

/**
 * Prime the sqlite-vec accelerated connection for `dbPath`. Runs at most once
 * per process; subsequent calls are no-ops. Called synchronously from
 * `db-bun.ts::buildClient` BEFORE the primary connection opens, so the macOS
 * `setCustomSQLite` one-shot ordering constraint is satisfied.
 *
 * No-op when acceleration is off (frugal default), on the compiled binary
 * (Bun #30717 guard), when the forced-unavailable test flag is set, when the
 * db is in-memory, or when the extension cannot be loaded — in every case RAG
 * transparently falls back to the Phase 1 app-side cosine path.
 */
export const primeSqliteVec = (dbPath: string): void => {
  if (resolved) return
  // eslint-disable-next-line functional/no-expression-statements -- one-shot resolution flag
  resolved = true

  const extensionPath = resolveAvailableExtensionPath(dbPath)
  if (extensionPath === undefined) return

  const client = openAndLoad(dbPath, extensionPath) ?? loadWithCustomSqlite(dbPath, extensionPath)
  if (client === undefined) {
    logWarning(
      'RAG_SQLITE_VEC=on requested but the sqlite-vec extension could not be loaded — ' +
        'falling back to app-side cosine (Phase 1).'
    )
    return
  }

  // eslint-disable-next-line functional/no-expression-statements -- record the accelerated connection for the search path
  accelerationClient = client
  logInfo('RAG_SQLITE_VEC=on — sqlite-vec acceleration enabled (ANN index over RAG embeddings).')
}

/**
 * The accelerated connection, or `undefined` when acceleration is off /
 * unavailable. The search path consults this; `undefined` means use Phase 1
 * app-side cosine.
 */
export const getSqliteVecClient = (): BunSqlite | undefined => accelerationClient

/**
 * Reset the module-level acceleration memo. Test-isolation hook only — mirrors
 * `resetDbCache()` so a spec that re-points `DATABASE_URL` / toggles the env var
 * re-resolves acceleration against the new connection. Production never calls it.
 *
 * @internal
 */
export const resetSqliteVecCache = (): void => {
  if (accelerationClient !== undefined) {
    try {
      accelerationClient.close()
    } catch {
      // ignore close failures during test teardown
    }
  }
  // eslint-disable-next-line functional/no-expression-statements -- module-level memo reset
  resolved = false
  // eslint-disable-next-line functional/no-expression-statements -- module-level memo reset
  accelerationClient = undefined
}
