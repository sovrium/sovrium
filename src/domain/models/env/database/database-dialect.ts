/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as path from 'node:path'
import { Schema } from 'effect'
import { defaultSqliteDbPath } from '../data-dir'

/**
 * Database dialect.
 *
 * - `postgres`: PostgreSQL (Drizzle on `bun:sql`) — selected when `DATABASE_URL` is set
 * - `sqlite`: SQLite (Drizzle on `bun:sqlite`) — the zero-config, frugal-by-default engine
 */
export const DatabaseDialectType = Schema.Literal('postgres', 'sqlite')

/** @public */
export type DatabaseDialect = Schema.Schema.Type<typeof DatabaseDialectType>

/**
 * Operator-facing runtime label reported by `GET /api/admin/config/version`.
 *
 * SQLite runs as the All-in-One (AIO) single-binary deployment, so it is
 * surfaced to operators as `sqlite-aio` (the literal the version endpoint and
 * `version.spec.ts` already lock in), distinct from the internal `sqlite`
 * dialect used to wire drivers and schemas.
 */
export const SovriumRuntimeLabelType = Schema.Literal('postgres', 'sqlite-aio')

/** @public */
export type SovriumRuntimeLabel = Schema.Schema.Type<typeof SovriumRuntimeLabelType>

/**
 * PostgreSQL dialect configuration.
 */
export const PostgresDialectSchema = Schema.Struct({
  dialect: Schema.Literal('postgres'),
  databaseUrl: Schema.String.pipe(
    Schema.pattern(/^postgres(ql)?:\/\/.+/),
    Schema.annotations({
      description: 'PostgreSQL connection string (DATABASE_URL)',
      examples: ['postgresql://user:pass@localhost:5432/sovrium'],
    })
  ),
})

/**
 * SQLite dialect configuration.
 *
 * `path` is either an absolute filesystem path or the `:memory:` sentinel for
 * an ephemeral in-process database.
 */
export const SqliteDialectSchema = Schema.Struct({
  dialect: Schema.Literal('sqlite'),
  path: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Resolved SQLite database file path, or ":memory:"',
      examples: ['./database.db', ':memory:'],
    })
  ),
})

/**
 * Unified database dialect configuration (discriminated union on `dialect`).
 */
export const DatabaseDialectSchema = Schema.Union(PostgresDialectSchema, SqliteDialectSchema)

/** @public */
export type DatabaseDialectConfig = Schema.Schema.Type<typeof DatabaseDialectSchema>
/** @public */
export type PostgresDialectConfig = Schema.Schema.Type<typeof PostgresDialectSchema>
/** @public */
export type SqliteDialectConfig = Schema.Schema.Type<typeof SqliteDialectSchema>

/** Sentinel for an ephemeral in-memory SQLite database (passed through verbatim). */
export const SQLITE_MEMORY_PATH = ':memory:'

/** Recognized SQLite URL scheme prefixes (aliases for the same on-disk file). */
const SQLITE_SCHEME_RE = /^(file:|sqlite:\/\/|sqlite:)/

/**
 * Extract a bare filesystem path (or the `:memory:` sentinel) from a
 * SQLite-family `DATABASE_URL`.
 *
 * Callers only reach this AFTER the postgres branch and the unset/empty branch
 * are excluded, so a value that is neither the `:memory:` sentinel nor a
 * recognized SQLite scheme means "DATABASE_URL is set to something we don't
 * understand" — we throw at decode time (fail-loud) rather than silently
 * treating a bare path as SQLite.
 *
 * - `:memory:`            → `:memory:`            (passthrough, no resolve)
 * - `file:./x.db`         → resolve('./x.db')
 * - `file:/var/x.db`      → resolve('/var/x.db')
 * - `sqlite:./x.db`       → resolve('./x.db')
 * - `sqlite:///var/x.db`  → resolve('/var/x.db')  (triple-slash → absolute)
 * - anything else         → throw (unsupported scheme)
 */
const parseSqliteUrl = (raw: string): string => {
  if (raw === SQLITE_MEMORY_PATH) return SQLITE_MEMORY_PATH

  const match = SQLITE_SCHEME_RE.exec(raw)
  if (!match) {
    // eslint-disable-next-line functional/no-throw-statements -- mirrors parseStorageEnvConfig: throw so error.message surfaces the bad DATABASE_URL at startup
    throw new Error(
      `Unsupported DATABASE_URL scheme: "${raw}". Use postgres://, postgresql://, ` +
        `file:, sqlite:, or :memory:. A bare filesystem path is not accepted — ` +
        `prefix it with file: (e.g. file:./database.db).`
    )
  }

  const strippedPath = raw.slice(match[0].length)
  if (strippedPath === '') {
    // eslint-disable-next-line functional/no-throw-statements -- mirrors parseStorageEnvConfig: throw so error.message surfaces the bad DATABASE_URL at startup
    throw new Error(
      `Empty path in DATABASE_URL: "${raw}". Provide a file path (e.g. file:./database.db).`
    )
  }
  return path.resolve(strippedPath)
}

/**
 * Resolve the active database dialect from environment variables.
 *
 * Resolution mirrors `parseStorageEnvConfig` — frugal-by-default, operators
 * opt *out* of SQLite by configuring PostgreSQL, never *in*. The single
 * `DATABASE_URL` variable is scheme-discriminated:
 *
 * 1. `postgres://` / `postgresql://`  → PostgreSQL
 * 2. unset / empty                    → SQLite at the default `<dataDir>/database.db`
 * 3. `file:` / `sqlite:` / `:memory:` → SQLite at the configured path
 * 4. anything else                    → throw at decode time (fail-loud)
 *
 * The `:memory:` sentinel is passed through verbatim; every other SQLite path
 * is resolved to an absolute path against the current working directory so the
 * spawned server and any tooling agree on the same file.
 *
 * @public
 */
export const parseDatabaseDialectConfig = (): DatabaseDialectConfig => {
  const databaseUrl = process.env.DATABASE_URL

  // 1. Postgres scheme → PostgreSQL (unchanged behavior).
  if (databaseUrl && /^postgres(ql)?:\/\//.test(databaseUrl)) {
    return Schema.decodeUnknownSync(PostgresDialectSchema)({
      dialect: 'postgres',
      databaseUrl,
    })
  }

  // 2. Unset / empty → zero-config SQLite default under the consolidated data
  //    dir (`<SOVRIUM_DATA_DIR>/database.db`, default `./.sovrium/database.db`).
  if (!databaseUrl) {
    return Schema.decodeUnknownSync(SqliteDialectSchema)({
      dialect: 'sqlite',
      path: defaultSqliteDbPath(),
    })
  }

  // 3. Set & non-postgres → SQLite family (file:/sqlite:/:memory:) or throw.
  return Schema.decodeUnknownSync(SqliteDialectSchema)({
    dialect: 'sqlite',
    path: parseSqliteUrl(databaseUrl),
  })
}

/**
 * Default PostgreSQL connection-pool size.
 *
 * Mirrors `bun:sql`'s own documented default (`SQLOptions.max`, 10). It is
 * declared HERE rather than left implicit so the number the application budgets
 * against is a stated constant instead of an assumption about the driver.
 *
 * Why that matters: `application/use-cases/admin/overview.ts` documents a peak
 * of ~8 connections for the cross-domain roll-up, "under bun:sql's
 * ~10-connection default pool". That budget is PER REQUEST. The 2026-07-25
 * production incident observed three concurrent overview requests
 * (`07:50:35.591/.595/.599`) — ~24 connections against ~10 — so every query
 * queued and every failure landed on the 30 s wall together. The roll-up is now
 * bounded across requests too (see `ADMIN_OVERVIEW_MAX_CONCURRENT`), and an
 * operator who provisions a larger Postgres can raise the ceiling here.
 */
const DEFAULT_DATABASE_POOL_MAX = 10

/**
 * Resolve the PostgreSQL connection-pool size from `DATABASE_POOL_MAX`.
 *
 * A deployment/capacity concern, so an env var — never the app schema (the app
 * schema describes the application, not the machine it runs on). A missing,
 * non-numeric, or non-positive value falls back to
 * {@link DEFAULT_DATABASE_POOL_MAX}. Mirrors the `parseBlockTimeoutMs` idiom in
 * `application/use-cases/admin/overview.ts`.
 *
 * SQLite ignores this entirely — `bun:sqlite` is a single embedded handle with
 * no pool.
 *
 * @public
 */
export const resolveDatabasePoolMax = (): number => {
  const raw = process.env.DATABASE_POOL_MAX
  const parsed = raw === undefined ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DATABASE_POOL_MAX
}

/**
 * Map the resolved dialect to the operator-facing runtime label used by
 * `GET /api/admin/config/version`.
 *
 * @public
 */
export const resolveRuntimeLabel = (): SovriumRuntimeLabel =>
  parseDatabaseDialectConfig().dialect === 'postgres' ? 'postgres' : 'sqlite-aio'
