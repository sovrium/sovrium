/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { UnsupportedInSqliteError } from '../unsupported-in-sqlite'
import type { RawSqlRunner } from '../sql/dialect-execute'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'
import type { drizzle as drizzlePg } from 'drizzle-orm/bun-sql'

/**
 * What the code may ask of a connection, typed so that the two engines cannot
 * be confused.
 *
 * The query builder is the portable subset: both drivers implement `select`,
 * `insert`, `update`, `delete`, `$with`, `with` and `$count`, and the builders
 * they return differ only in details this codebase does not use. Its member
 * types are spelled by the PostgreSQL driver because one spelling is needed;
 * the SQLite client meets them structurally at `buildClient`, the one place the
 * claim is made.
 *
 * Raw SQL is not part of it. `execute` exists on PostgreSQL only and `all` on
 * SQLite only, so both are optional here: calling either directly fails the
 * typecheck, and {@link RawSqlRunner}'s `executeRawOn` is the one seam that
 * picks the right one for a dialect. A statement that only PostgreSQL can run
 * asks {@link getPgDb}, which refuses on SQLite.
 */

/** The PostgreSQL client, with its PostgreSQL-only members. Reached through {@link getPgDb}. */
export type PgDb = ReturnType<typeof drizzlePg>

/** The transaction handle of the PostgreSQL client. Reached through {@link getPgDb}. */
export type PgTx = Parameters<Parameters<PgDb['transaction']>[0]>[0]

/** The statements a connection and a transaction both run. */
export type PortableQueries = Pick<
  PgDb,
  'select' | 'selectDistinct' | 'insert' | 'update' | 'delete' | '$with' | 'with' | '$count'
> &
  RawSqlRunner

/** An open transaction on either engine; a nested `transaction` is a savepoint. */
export type PortableTx = PortableQueries & {
  readonly rollback: () => never
  readonly transaction: <T>(body: (tx: PortableTx) => Promise<T>) => Promise<T>
}

/** A connection on either engine. */
export type PortableDb = PortableQueries & {
  readonly transaction: <T>(body: (tx: PortableTx) => Promise<T>) => Promise<T>
}

/** The engine a handle speaks, as far as {@link getPgDb} needs to know. */
interface OnDialect {
  readonly dialect: { readonly kind: DatabaseDialect }
}

/**
 * The door to PostgreSQL-only members: the connection or the transaction typed
 * as the PostgreSQL driver's own, for a statement SQLite cannot run. Asking for
 * it on SQLite is an error rather than a compile-time gap, so the boundary is
 * explicit at the call site.
 *
 * @throws {UnsupportedInSqliteError} on the SQLite engine
 */
export function getPgDb(on: OnDialect & { readonly client: PortableDb }): PgDb
export function getPgDb(on: OnDialect & { readonly tx: PortableTx }): PgTx
export function getPgDb(
  on: OnDialect & { readonly client?: PortableDb; readonly tx?: PortableTx }
): PgDb | PgTx {
  if (on.dialect.kind === 'sqlite') {
    throw new UnsupportedInSqliteError({
      feature: 'raw-sql',
      message:
        'This statement requires the PostgreSQL runtime. It is not available on the SQLite (zero-config) runtime.',
    })
  }
  // eslint-disable-next-line sovrium/no-double-assertion -- past the SQLite refusal the handle IS the PostgreSQL driver's: the one place the narrower type is widened back
  return (on.tx ?? on.client) as unknown as PgDb | PgTx
}
