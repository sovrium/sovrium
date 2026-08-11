/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'

/**
 * Graceful-degradation boundary for the SQLite runtime.
 *
 * Sovrium runs on two database engines (see `database-dialect.ts`):
 *
 *   - **PostgreSQL** — the full-feature engine. Raw `db.execute(sql\`…\`)`,
 *     `pgvector` RAG, `pg_notify` realtime, PL/pgSQL triggers, partitioned
 *     audit-log archives, `pg_stat_statements`, etc.
 *   - **SQLite** — the zero-config, frugal-by-default engine. It supports the
 *     core subset (schema / auth / records CRUD / migrations / forms) but not
 *     the Postgres-only advanced features.
 *
 * Those advanced features must **degrade gracefully** — return a clear,
 * machine-readable failure — rather than crash with a low-level driver error.
 * This module is the single typed seam for that boundary:
 *
 *   - {@link UnsupportedInSqliteError} — the tagged error a Postgres-only code
 *     path raises when reached on SQLite.
 *   - {@link isSqliteRuntime} — the runtime check guards branch on.
 *
 * HTTP routes degrade per-route (e.g. the RAG route's SQLite repository
 * implementation, the `AI_PROVIDER` `503` gate) rather than via a shared
 * runtime-gating middleware. There is no HTTP-level runtime gate at all any
 * more, and no OpenAPI runtime annotation either: the `501 requires-postgres`
 * contract and the `x-sovrium-runtimes` extension that advertised it were both
 * removed once every route learned to serve both dialects. A route that
 * genuinely cannot serve SQLite should raise {@link UnsupportedInSqliteError}
 * from its own handler and map it to a status of its choosing. This module
 * covers the non-HTTP surfaces — the `getPgDb()` escape hatch and any
 * service-layer guard.
 */

/**
 * Error raised when a PostgreSQL-only feature is invoked on the SQLite runtime.
 *
 * `feature` names the capability (for logs / dashboards); `message` is the
 * operator-facing explanation. This is an Effect `Data.TaggedError`, so it
 * pattern-matches with `Effect.catchTag('UnsupportedInSqliteError', …)` and is
 * `instanceof`-checkable.
 */
export class UnsupportedInSqliteError extends Data.TaggedError('UnsupportedInSqliteError')<{
  /** The PostgreSQL-only capability that was reached (e.g. `'raw-sql'`, `'pgvector-rag'`). */
  readonly feature: string
  /** Operator-facing explanation of why the call failed and what to do. */
  readonly message: string
}> {}

/**
 * Whether the active database runtime is SQLite.
 *
 * Delegates to `parseDatabaseDialectConfig()` — the single source of truth for
 * dialect selection. PostgreSQL is used when `DATABASE_URL` is set; SQLite (the
 * zero-config, frugal-by-default engine) is used otherwise.
 */
export const isSqliteRuntime = (): boolean => parseDatabaseDialectConfig().dialect === 'sqlite'
