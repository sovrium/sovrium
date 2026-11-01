/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { Effect, Option } from 'effect'
import {
  UserAccessDatabaseError,
  UserAccessRepository,
  type RecordKeySource,
  type RecordLabel,
  type RecordLabelSource,
  type UserAccessChange,
  type UserAccessFilter,
  type UserAccessInsertInput,
  type UserAccessRecordGrant,
  type UserAccessRecordRevocation,
  type UserAccessRow,
} from '@/application/ports/repositories/auth/user-access-repository'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import {
  authUsersTable,
  resolveDialectSchema,
} from '@/infrastructure/database/drizzle/dialect-schema'
import {
  layerOverDatabase,
  type DatabaseService,
  type MembersOverDatabase,
  type TransactionOn,
} from '@/infrastructure/database/drizzle/layer'
import { userAccess as userAccessPg } from '@/infrastructure/database/drizzle/schema/user-access'
import { userAccess as userAccessSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/user-access'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { withPromiseTransaction } from '@/infrastructure/database/transaction'
import {
  lockGrantsOfOn,
  type GrantTransaction,
} from '@/infrastructure/database/user-access-grant-lock'
import { closeUserConnections } from '@/infrastructure/realtime/connection-counter'
import type { PortableDb, PortableTx } from '@/infrastructure/database/drizzle/db'

const userAccess = resolveDialectSchema(userAccessPg, userAccessSqlite)

/** Wrap a DB promise, adapting failures to UserAccessDatabaseError. */
const toError = (cause: unknown) => new UserAccessDatabaseError({ cause })
const wrap = makeDbWrap(toError)

/** A grant write in ONE transaction, on the caller's fiber (`withTransaction`). */
const transact = <A>(db: PortableDb, body: (tx: Readonly<PortableTx>) => Promise<A>) =>
  withPromiseTransaction(db, body, toError)

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
const accountsWithEmail = (db: PortableDb, email: string) => {
  const users = authUsersTable()
  return db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
}

/** The SQL half of a listing filter: the account and the table, bound as values. */
const filterCondition = (db: PortableDb, filter: Readonly<UserAccessFilter>) =>
  and(
    filter.userId === undefined ? undefined : eq(userAccess.userId, filter.userId),
    filter.userEmail === undefined
      ? undefined
      : inArray(userAccess.userId, accountsWithEmail(db, filter.userEmail)),
    filter.tableSlug === undefined ? undefined : eq(userAccess.tableSlug, filter.tableSlug)
  )

const boundIds = (ids: readonly string[]) =>
  sql.join(
    [...new Set(ids)].map((id) => sql`${id}`),
    sql`, `
  )

/**
 * The label of each record among `ids`: identifiers through `sql.identifier()`,
 * ids bound as values. The key is compared as TEXT so a numeric primary key
 * answers the string ids a grant stores.
 */
const readRecordLabels = async (
  { client: db, dialect }: DatabaseService,
  source: Readonly<RecordLabelSource>,
  ids: readonly string[]
): Promise<readonly RecordLabel[]> => {
  const key = sql.identifier(source.primaryKey)
  const label = sql.identifier(source.labelField)
  const wanted = boundIds(ids)
  const rows = await executeRawOn(
    dialect.kind,
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
 * The ids among `ids` naming a record of the source table outside the trash,
 * compared as TEXT (see above). A trashed record is no grantable record: a grant
 * naming it would store access nobody can use until a restore nobody tied to it.
 */
const readRecordIds = async (
  { client: db, dialect }: DatabaseService,
  source: Readonly<RecordKeySource>,
  ids: readonly string[]
): Promise<readonly string[]> => {
  const key = sql.identifier(source.primaryKey)
  const wanted = boundIds(ids)
  const rows = await executeRawOn(
    dialect.kind,
    db,
    sql`SELECT CAST(${key} AS TEXT) AS record_id
        FROM ${sql.identifier(sanitizeTableName(source.tableName))}
        WHERE CAST(${key} AS TEXT) IN (${wanted}) AND deleted_at IS NULL`
  )
  return rows.map((row) => String(row['record_id']))
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

/** The account's grants over the table, oldest first, read inside the lock. */
const grantsHeld = (
  tx: GrantTransaction,
  grant: Readonly<Pick<UserAccessRecordGrant, 'userId' | 'tableSlug'>>
) =>
  tx
    .select()
    .from(userAccess)
    .where(and(eq(userAccess.userId, grant.userId), eq(userAccess.tableSlug, grant.tableSlug)))
    .orderBy(asc(userAccess.createdAt))

/**
 * The account's grant over the table under the input's role, with the input's
 * records it does not name yet appended — or a new grant naming them, when it
 * holds none — written inside the lock. `changed` is `false` when the grant
 * already named every record.
 *
 * `created_at` comes from the host clock, not the DDL's `DEFAULT NOW()`: the
 * response is compared against the caller's own clock, and a database clock a
 * few milliseconds apart would put a fresh grant in the caller's future.
 */
const mergeRecords = async (
  { tx, dialect }: TransactionOn,
  input: Readonly<UserAccessInsertInput>,
  createdBy: string
) => {
  await lockGrantsOfOn(dialect.kind, tx, input)
  const held = (await grantsHeld(tx, input)).find((row) => row.role === input.role)
  if (held === undefined) {
    const [row] = await tx
      .insert(userAccess)
      .values({
        userId: input.userId,
        tableSlug: input.tableSlug,
        recordIds: [...new Set(input.recordIds)],
        role: input.role,
        createdAt: new Date(),
        createdBy,
      })
      .returning()
    if (!row) throw new Error('user_access INSERT returned no rows')
    return { row, created: true, changed: true }
  }
  const added = [...new Set(input.recordIds)].filter((id) => !held.recordIds.includes(id))
  if (added.length === 0) return { row: held, created: false, changed: false }
  const [row] = await tx
    .update(userAccess)
    .set({ recordIds: [...held.recordIds, ...added] })
    .where(eq(userAccess.id, held.id))
    .returning()
  if (!row) throw new Error('user_access UPDATE returned no rows')
  return { row, created: false, changed: true }
}

/**
 * Take the record out of each grant naming it — under the revocation's role
 * only, when it names one — inside the lock; how many grants changed.
 */
const takeRecord = async (
  { tx, dialect }: TransactionOn,
  grant: Readonly<UserAccessRecordRevocation>
): Promise<number> => {
  await lockGrantsOfOn(dialect.kind, tx, grant)
  const naming = (await grantsHeld(tx, grant)).filter(
    (row) =>
      row.recordIds.includes(grant.recordId) &&
      (grant.role === undefined || row.role === grant.role)
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
 * Apply `change` to the grant `id` inside the lock, or `undefined` when no grant
 * has the id. A role change onto a role the account already holds over the
 * table folds the grant into the held one — which keeps its id and its records'
 * order, gains the records not yet named, and is the answer — and deletes it.
 */
const changeGrant = async (
  { tx, dialect }: TransactionOn,
  id: string,
  change: Readonly<UserAccessChange>
): Promise<typeof userAccess.$inferSelect | undefined> => {
  const byId = () => tx.select().from(userAccess).where(eq(userAccess.id, id)).limit(1)
  const [found] = await byId()
  if (found === undefined) return undefined
  await lockGrantsOfOn(dialect.kind, tx, found)
  const [target] = await byId()
  if (target === undefined) return undefined
  const held =
    change.role === undefined || change.role === target.role
      ? undefined
      : (await grantsHeld(tx, target)).find(
          (row) => row.role === change.role && row.id !== target.id
        )
  if (held === undefined) {
    const [row] = await tx
      .update(userAccess)
      .set(changedColumns(change))
      .where(eq(userAccess.id, id))
      .returning()
    return row
  }
  const added = [...new Set(change.recordIds ?? target.recordIds)].filter(
    (recordId) => !held.recordIds.includes(recordId)
  )
  await tx.delete(userAccess).where(eq(userAccess.id, id))
  if (added.length === 0) return held
  const [row] = await tx
    .update(userAccess)
    .set({ recordIds: [...held.recordIds, ...added] })
    .where(eq(userAccess.id, held.id))
    .returning()
  return row
}

/**
 * User-Access Repository Implementation (Drizzle).
 *
 * The DDL is engine-managed via `schema-initializer.ts`; this layer provides
 * type-safe inserts/selects against that schema.
 */
const members: MembersOverDatabase<typeof UserAccessRepository> = {
  mintGrant: (db, dialect) => (input, createdBy) =>
    transact(db, (tx) => mergeRecords({ tx, dialect }, input, createdBy)).pipe(
      Effect.flatMap((merged) =>
        wrap(async () => {
          const row = shapeRow(merged.row)
          return {
            row: merged.changed ? closingConnectionsOf(row) : row,
            created: merged.created,
          }
        })
      )
    ),

  findRecordIds: (db, dialect) => (source, ids) =>
    wrap(async () => (ids.length === 0 ? [] : readRecordIds({ client: db, dialect }, source, ids))),

  list: (db) => (filter) =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(userAccess)
        .where(filterCondition(db, filter))
        .orderBy(asc(userAccess.createdAt))
      return rows.map((row) => shapeRow(row)).filter(namesRecord(filter.recordId))
    }),

  findAccounts: (db) => (ids) =>
    wrap(async () => {
      if (ids.length === 0) return []
      const users = authUsersTable()
      return db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(inArray(users.id, [...new Set(ids)]))
    }),

  labelRecords: (client, dialect) => (source, ids) =>
    wrap(async () => (ids.length === 0 ? [] : readRecordLabels({ client, dialect }, source, ids))),

  get: (db) => (id) =>
    wrap(async () => {
      const [row] = await db.select().from(userAccess).where(eq(userAccess.id, id)).limit(1)
      return row === undefined ? Option.none() : Option.some(shapeRow(row))
    }),

  update: (db, dialect) => (id, change) =>
    Object.keys(changedColumns(change)).length === 0
      ? wrap(async () => {
          const [row] = await db.select().from(userAccess).where(eq(userAccess.id, id)).limit(1)
          return row === undefined ? Option.none() : Option.some(shapeRow(row))
        })
      : transact(db, (tx) => changeGrant({ tx, dialect }, id, change)).pipe(
          Effect.flatMap((row) =>
            wrap(async () =>
              row === undefined ? Option.none() : Option.some(closingConnectionsOf(shapeRow(row)))
            )
          )
        ),

  grantRecord:
    (db, dialect) =>
    ({ recordId, ...rest }, createdBy) =>
      transact(db, (tx) =>
        mergeRecords({ tx, dialect }, { ...rest, recordIds: [recordId] }, createdBy)
      ).pipe(
        Effect.flatMap((merged) =>
          wrap(async () => {
            if (!merged.changed) return false
            closingConnectionsOf(shapeRow(merged.row))
            return true
          })
        )
      ),

  revokeRecord: (db, dialect) => (grant) =>
    transact(db, (tx) => takeRecord({ tx, dialect }, grant)).pipe(
      Effect.flatMap((changed) =>
        wrap(async () => {
          if (changed === 0) return false
          closeUserConnections(grant.userId)
          return true
        })
      )
    ),

  remove: (db) => (id) =>
    wrap(async () => {
      const [row] = await db.delete(userAccess).where(eq(userAccess.id, id)).returning()
      return row === undefined ? Option.none() : Option.some(closingConnectionsOf(shapeRow(row)))
    }),
}

export const UserAccessRepositoryLive = layerOverDatabase(UserAccessRepository, members)
