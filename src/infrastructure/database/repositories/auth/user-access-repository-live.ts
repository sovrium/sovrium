/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { Layer, Option } from 'effect'
import {
  UserAccessDatabaseError,
  UserAccessRepository,
  type RecordLabel,
  type RecordLabelSource,
  type UserAccessChange,
  type UserAccessFilter,
  type UserAccessRecordGrant,
  type UserAccessRow,
} from '@/application/ports/repositories/auth/user-access-repository'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { db } from '@/infrastructure/database'
import {
  authUsersTable,
  resolveDialectSchema,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { userAccess as userAccessPg } from '@/infrastructure/database/drizzle/schema/user-access'
import { userAccess as userAccessSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/user-access'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { closeUserConnections } from '@/infrastructure/realtime/connection-counter'

const userAccess = resolveDialectSchema(userAccessPg, userAccessSqlite)

/** Wrap a DB promise, adapting failures to UserAccessDatabaseError. */
const wrap = makeDbWrap((cause) => new UserAccessDatabaseError({ cause }))

/**
 * Project a Drizzle row into the port's `UserAccessRow` shape. Centralised
 * so insert and list paths emit identical envelopes (and the route handler
 * can stay agnostic of Drizzle's `$inferSelect` typing).
 */
const shapeRow = (row: Readonly<typeof userAccess.$inferSelect>): UserAccessRow => ({
  id: row.id,
  userId: row.userId,
  tableSlug: row.tableSlug,
  recordIds: row.recordIds,
  role: row.role,
  createdAt: row.createdAt,
  createdBy: row.createdBy ?? undefined,
})

/**
 * The accounts holding `email`, matched without regard to case — a subquery, so
 * an address no account holds narrows the listing to nothing.
 */
const accountsWithEmail = (email: string) => {
  const users = authUsersTable()
  return db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
}

/** The SQL half of a listing filter: the account and the table, bound as values. */
const filterCondition = (filter: Readonly<UserAccessFilter>) =>
  and(
    filter.userId === undefined ? undefined : eq(userAccess.userId, filter.userId),
    filter.userEmail === undefined
      ? undefined
      : inArray(userAccess.userId, accountsWithEmail(filter.userEmail)),
    filter.tableSlug === undefined ? undefined : eq(userAccess.tableSlug, filter.tableSlug)
  )

/**
 * The label of each record among `ids`: identifiers through `sql.identifier()`,
 * ids bound as values. The key is compared as TEXT so a numeric primary key
 * answers the string ids a grant stores.
 */
const readRecordLabels = async (
  source: Readonly<RecordLabelSource>,
  ids: readonly string[]
): Promise<readonly RecordLabel[]> => {
  const key = sql.identifier(source.primaryKey)
  const label = sql.identifier(source.labelField)
  const wanted = sql.join(
    [...new Set(ids)].map((id) => sql`${id}`),
    sql`, `
  )
  const rows = await executeRaw(
    db,
    sql`SELECT CAST(${key} AS TEXT) AS record_id, ${label} AS label
        FROM ${sql.identifier(sanitizeTableName(source.tableName))}
        WHERE CAST(${key} AS TEXT) IN (${wanted})`
  )
  return rows.flatMap((row) =>
    typeof row['label'] === 'string' && row['label'] !== ''
      ? [{ id: String(row['record_id']), label: row['label'] }]
      : []
  )
}

/**
 * The record half of a listing filter, applied to the rows read: `record_ids`
 * is a `TEXT[]` on PostgreSQL and a JSON array on SQLite, and the grants of
 * one table are few, so one portable comparison serves both engines.
 */
const namesRecord =
  (recordId: string | undefined) =>
  (row: Readonly<UserAccessRow>): boolean =>
    recordId === undefined || row.recordIds.includes(recordId)

/**
 * A written grant, once its account's live realtime connections are closed.
 *
 * A grant decides which records a subscription may stream, and a connection
 * judges it once, at its handshake. So every write that moves a grant closes
 * the account's connections, which reconnect and are judged against the grant
 * as it now stands. Closing here, where every write lands, covers each road
 * that writes one: the access-grant routes, the automation actions and the
 * seed. A road that wrote without closing would leave a revoked account
 * streaming records until it reconnected on its own.
 */
const closingConnectionsOf = (row: Readonly<UserAccessRow>): UserAccessRow => {
  closeUserConnections(row.userId)
  return row
}

type GrantTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Hold the account's grants over one table until the transaction ends, so the
 * read-change-write of `record_ids` below is never interleaved with another.
 *
 * PostgreSQL: a transaction-scoped advisory lock keyed on the account and the
 * table — it serialises the changes even when no grant exists yet to lock as a
 * row (two first grants would otherwise both insert). SQLite: nothing to take,
 * the transaction itself is `BEGIN IMMEDIATE`, serialised against every other
 * statement on the one connection (`sqlite-serialized-client.ts`).
 */
const lockGrantsOf = async (
  tx: GrantTransaction,
  grant: Readonly<UserAccessRecordGrant>
): Promise<void> => {
  if (isSqliteRuntime()) return
  const key = JSON.stringify(['user_access', grant.userId, grant.tableSlug])
  await executeRaw(tx, sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`)
}

/** The account's grants over the table, oldest first, read inside the lock. */
const grantsHeld = (tx: GrantTransaction, grant: Readonly<UserAccessRecordGrant>) =>
  tx
    .select()
    .from(userAccess)
    .where(and(eq(userAccess.userId, grant.userId), eq(userAccess.tableSlug, grant.tableSlug)))
    .orderBy(asc(userAccess.createdAt))

/** The grant the record now joins, written inside the lock; `undefined` when it already held it. */
const addRecord = async (
  tx: GrantTransaction,
  grant: Readonly<UserAccessRecordGrant & { readonly role: string }>,
  createdBy: string
) => {
  await lockGrantsOf(tx, grant)
  const held = (await grantsHeld(tx, grant)).find((row) => row.role === grant.role)
  if (held === undefined) {
    const [row] = await tx
      .insert(userAccess)
      .values({
        userId: grant.userId,
        tableSlug: grant.tableSlug,
        recordIds: [grant.recordId],
        role: grant.role,
        createdAt: new Date(),
        createdBy,
      })
      .returning()
    return row
  }
  if (held.recordIds.includes(grant.recordId)) return undefined
  const [row] = await tx
    .update(userAccess)
    .set({ recordIds: [...held.recordIds, grant.recordId] })
    .where(eq(userAccess.id, held.id))
    .returning()
  return row
}

/** Take the record out of each grant naming it, inside the lock; how many grants changed. */
const takeRecord = async (
  tx: GrantTransaction,
  grant: Readonly<UserAccessRecordGrant>
): Promise<number> => {
  await lockGrantsOf(tx, grant)
  const naming = (await grantsHeld(tx, grant)).filter((row) =>
    row.recordIds.includes(grant.recordId)
  )
  for (const row of naming) {
    const remaining = row.recordIds.filter((id) => id !== grant.recordId)
    await (remaining.length === 0
      ? tx.delete(userAccess).where(eq(userAccess.id, row.id))
      : tx.update(userAccess).set({ recordIds: remaining }).where(eq(userAccess.id, row.id)))
  }
  return naming.length
}

/** The columns a change writes: only those it names. */
const changedColumns = (change: Readonly<UserAccessChange>) => ({
  ...(change.recordIds === undefined ? {} : { recordIds: [...change.recordIds] }),
  ...(change.role === undefined ? {} : { role: change.role }),
})

/**
 * User-Access Repository Implementation (Drizzle).
 *
 * Replaces the raw `bun:sql` access that previously lived in
 * `user-access-handlers.ts` (R-1 audit follow-up). The DDL is still
 * engine-managed via `schema-initializer.ts` — this layer just provides
 * type-safe inserts/selects against that schema.
 */
export const UserAccessRepositoryLive = Layer.succeed(UserAccessRepository, {
  insert: (input, createdBy) =>
    wrap(async () => {
      // We populate `createdAt` from the JS clock rather than relying
      // on the DDL's `DEFAULT NOW()`. Two reasons:
      //   1. The Z-2 spec asserts the returned `created_at` is bounded
      //      by the test process's `Date.now()` at request entry — a
      //      DB-clock-vs-host-clock skew (≤10ms in containerised
      //      Postgres) flips that assertion intermittently.
      //   2. The previous raw-SQL implementation paid ~50ms of
      //      connection-setup latency per call, which incidentally
      //      masked any clock skew. Reusing the pool removes that
      //      latency and exposes the timestamp ordering directly.
      // This is a *behaviour-preserving* tweak: the timestamp still
      // represents grant time within milliseconds of the request.
      const [row] = await db
        .insert(userAccess)
        .values({
          userId: input.userId,
          tableSlug: input.tableSlug,
          recordIds: [...input.recordIds],
          role: input.role,
          createdAt: new Date(),
          createdBy,
        })
        .returning()
      if (!row) {
        throw new Error('user_access INSERT returned no rows')
      }
      return closingConnectionsOf(shapeRow(row))
    }),

  list: (filter) =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(userAccess)
        .where(filterCondition(filter))
        .orderBy(asc(userAccess.createdAt))
      return rows.map((row) => shapeRow(row)).filter(namesRecord(filter.recordId))
    }),

  findAccounts: (ids) =>
    wrap(async () => {
      if (ids.length === 0) return []
      const users = authUsersTable()
      return db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(inArray(users.id, [...new Set(ids)]))
    }),

  labelRecords: (source, ids) =>
    wrap(async () => (ids.length === 0 ? [] : readRecordLabels(source, ids))),

  get: (id) =>
    wrap(async () => {
      const [row] = await db.select().from(userAccess).where(eq(userAccess.id, id)).limit(1)
      return row === undefined ? Option.none() : Option.some(shapeRow(row))
    }),

  update: (id, change) =>
    wrap(async () => {
      const columns = changedColumns(change)
      if (Object.keys(columns).length === 0) {
        const [row] = await db.select().from(userAccess).where(eq(userAccess.id, id)).limit(1)
        return row === undefined ? Option.none() : Option.some(shapeRow(row))
      }
      const [row] = await db
        .update(userAccess)
        .set(columns)
        .where(eq(userAccess.id, id))
        .returning()
      return row === undefined ? Option.none() : Option.some(closingConnectionsOf(shapeRow(row)))
    }),

  grantRecord: (grant, createdBy) =>
    wrap(async () => {
      const row = await db.transaction((tx) => addRecord(tx, grant, createdBy))
      if (row === undefined) return false
      closingConnectionsOf(shapeRow(row))
      return true
    }),

  revokeRecord: (grant) =>
    wrap(async () => {
      const changed = await db.transaction((tx) => takeRecord(tx, grant))
      if (changed === 0) return false
      closeUserConnections(grant.userId)
      return true
    }),

  remove: (id) =>
    wrap(async () => {
      const [row] = await db.delete(userAccess).where(eq(userAccess.id, id)).returning()
      return row === undefined ? Option.none() : Option.some(closingConnectionsOf(shapeRow(row)))
    }),
})
