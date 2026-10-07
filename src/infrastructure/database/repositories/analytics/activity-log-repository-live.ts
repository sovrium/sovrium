/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, gte, sql, type SQL } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  ActivityLogRepository,
  ActivityLogDatabaseError,
  type ActivityLog,
  type ActivityLogPage,
  type ActivityLogPageQuery,
} from '@/application/ports/repositories/analytics/activity-log-repository'
import { resolveActorUserId } from '@/domain/models/app/auth/guest-session'
import { db } from '@/infrastructure/database'
import {
  authUsersTable,
  resolveDialectSchema,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { activityLogs as activityLogsPg } from '@/infrastructure/database/drizzle/schema/activity-log'
import { activityLogs as activityLogsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/activity-log'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRawTyped } from '@/infrastructure/database/sql/dialect-execute'
import { listTableColumns } from '@/infrastructure/database/sql/dialect-introspection'
import { dateIntervalAgo } from '@/infrastructure/database/sql/dialect-sql-helpers'
import { isInValueSet } from '@/infrastructure/database/sql/value-set-membership'
import {
  admissionCondition,
  admissionForFilters,
  liveRowCondition,
  ruleTables,
} from '@/infrastructure/database/table-queries/query-helpers/activity-admission'
import {
  databaseTableName,
  tableIdentifier,
} from '@/infrastructure/database/table-queries/statement/validation'

const activityLogs = resolveDialectSchema(activityLogsPg, activityLogsSqlite)

/** Wrap a DB promise, adapting failures to ActivityLogDatabaseError. */
const wrap = makeDbWrap((error) => new ActivityLogDatabaseError({ cause: error }))

/** A user table's `id` as the activity log names it: text. */
const idAsText = sql`CAST(${sql.identifier('id')} AS TEXT)`

/** The columns `tableName` holds, as the database reports them. */
const tableColumns = async (tableName: string): Promise<ReadonlySet<string>> =>
  new Set((await listTableColumns(db, databaseTableName(tableName))).map((column) => column.name))

/** The record ids the activity of the last year names for `tableName`. */
const loggedRecordIds = (tableName: string) =>
  db
    .select({ recordId: activityLogs.recordId })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.tableName, tableName),
        gte(activityLogs.createdAt, dateIntervalAgo(1, 'year'))
      )
    )

/** Each `rule` table's columns, read one table after another (no pool fan-out). */
const ruleTableColumns = (
  tableNames: readonly string[]
): Promise<ReadonlyMap<string, ReadonlySet<string>>> =>
  tableNames.reduce<Promise<ReadonlyMap<string, ReadonlySet<string>>>>(
    async (done, tableName) =>
      new Map([...(await done), [tableName, await tableColumns(tableName)]]),
    Promise.resolve(new Map())
  )

/** The WHERE of the activity list: retention, filters, and the reader's admission. */

const pageCondition = (
  query: ActivityLogPageQuery,
  columnsOf: ReadonlyMap<string, ReadonlySet<string>>
): SQL | undefined => {
  const { filters } = query
  const admission = admissionForFilters(query.admission, filters)
  return and(
    gte(activityLogs.createdAt, dateIntervalAgo(1, 'year')),
    filters.tableName === undefined ? undefined : eq(activityLogs.tableName, filters.tableName),
    filters.action === undefined ? undefined : eq(activityLogs.action, filters.action),
    filters.userId === undefined ? undefined : eq(activityLogs.userId, filters.userId),
    filters.since === undefined ? undefined : gte(activityLogs.createdAt, filters.since),
    admission === 'everything'
      ? undefined
      : admissionCondition(
          admission,
          { tableName: activityLogs.tableName, recordId: activityLogs.recordId },
          (tableName) => columnsOf.get(tableName) ?? new Set()
        )
  )
}

/** One page of the admitted, filtered activity, and how many entries match in all. */
const listActivityPage = async (query: ActivityLogPageQuery): Promise<ActivityLogPage> => {
  const columnsOf = await ruleTableColumns(
    ruleTables(admissionForFilters(query.admission, query.filters))
  )
  const where = pageCondition(query, columnsOf)
  // Resolve the dialect-correct auth users table per call — the user
  // table lives at `auth.user` on Postgres and `auth_user` on SQLite.
  // Capturing it locally keeps the leftJoin + projection columns aligned.
  const users = authUsersTable()
  const rows = await db
    .select({
      id: activityLogs.id,
      createdAt: activityLogs.createdAt,
      userId: activityLogs.userId,
      sessionId: activityLogs.sessionId,
      action: activityLogs.action,
      tableName: activityLogs.tableName,
      tableId: activityLogs.tableId,
      recordId: activityLogs.recordId,
      changes: activityLogs.changes,
      ipAddress: activityLogs.ipAddress,
      userAgent: activityLogs.userAgent,
      userName: users.name,
      userEmail: users.email,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(where)
    .orderBy(
      sql`(${activityLogs.userId} IS NULL) DESC`,
      desc(activityLogs.createdAt),
      desc(activityLogs.id)
    )
    .limit(query.limit)
    .offset(query.offset)
  const [counted] = await db
    .select({ total: sql<number | string>`count(*)` })
    .from(activityLogs)
    .where(where)
  return { rows: rows.map(toActivityLog), total: Number(counted?.total ?? 0) }
}

/** A selected row as the port names it, the actor folded into `user`. */
const toActivityLog = (row: {
  readonly id: string
  readonly createdAt: Date
  readonly userId: string | null
  readonly sessionId: string | null
  readonly action: ActivityLog['action']
  readonly tableName: string
  readonly tableId: string | null
  readonly recordId: string
  readonly changes: ActivityLog['changes']
  readonly ipAddress: string | null
  readonly userAgent: string | null
  readonly userName: string | null
  readonly userEmail: string | null
}): ActivityLog => ({
  id: row.id,
  createdAt: row.createdAt,
  userId: row.userId,
  sessionId: row.sessionId,
  action: row.action,
  tableName: row.tableName,
  tableId: row.tableId,
  recordId: row.recordId,
  changes: row.changes,
  ipAddress: row.ipAddress,
  userAgent: row.userAgent,
  user:
    row.userId && row.userName && row.userEmail
      ? { id: row.userId, name: row.userName, email: row.userEmail }
      : null,
})

/**
 * Activity Log Repository Implementation
 *
 * Uses Drizzle ORM query builder for type-safe, SQL-injection-proof queries.
 */
export const ActivityLogRepositoryLive = Layer.succeed(ActivityLogRepository, {
  /**
   * One page of the activity of the last year, with the count of every entry
   * the filters and the reader's admission match — both judged here, so a
   * reader's page costs two statements however many records it names.
   */
  listPage: (query) => wrap(async () => listActivityPage(query)),

  /**
   * The live rows of one table an activity gate judges, in one statement.
   */
  liveRecords: (query) =>
    wrap(async () => {
      const columns = await tableColumns(query.tableName)
      const recordIds =
        query.recordIds === 'logged'
          ? sql`${idAsText} IN (${loggedRecordIds(query.tableName)})`
          : isInValueSet(idAsText, query.recordIds)
      return executeRawTyped<Readonly<Record<string, unknown>>>(
        db,
        sql`SELECT * FROM ${tableIdentifier(query.tableName)} WHERE ${liveRowCondition(columns, query.rule)} AND ${recordIds}`
      )
    }),

  /**
   * Create activity log entry.
   *
   * `user_id` references the user table, so a synthetic actor (`guest`,
   * `system`) is resolved to NULL here exactly as the activity-log helpers do —
   * an insert carrying the sentinel would fail the foreign key.
   */
  create: (log) =>
    wrap(async () => {
      const result = await db
        .insert(activityLogs)
        .values({
          id: crypto.randomUUID(),
          userId: resolveActorUserId(log.userId),
          action: log.action,
          tableName: log.tableName,
          tableId: log.tableId,
          recordId: log.recordId,
          changes: log.changes,
          sessionId: log.sessionId,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
        })
        .returning()

      return result[0]!
    }),
})
