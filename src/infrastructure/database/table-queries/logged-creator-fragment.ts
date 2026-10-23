/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { activityLogs as activityLogsPg } from '@/infrastructure/database/drizzle/schema/activity-log'
import { activityLogs as activityLogsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/activity-log'
import type { NotLoggedCreatorValue } from '@/domain/models/app/tables/read-state-service'

/**
 * The WHERE condition "the row on `column` was not created by `value.userId`,
 * as the activity log records the creation of rows of `value.tableName`".
 *
 * An uncorrelated `NOT IN (SELECT …)` over the activity log, so however many
 * rows she created the condition binds two values — a list of her row ids
 * would grow past the database's bound-parameter ceiling. The outer column is
 * compared as text, as the log stores every record id. `record_id` is never
 * NULL, so `NOT IN` keeps its plain meaning.
 */
export const notLoggedCreatorFragment = (
  column: string,
  value: NotLoggedCreatorValue
): Readonly<SQL> => {
  const activityLogs = resolveDialectSchema(activityLogsPg, activityLogsSqlite)
  const created = sql`SELECT ${sql.identifier('record_id')} FROM ${activityLogs} WHERE ${sql.identifier('table_name')} = ${value.tableName} AND ${sql.identifier('action')} = ${'create'} AND ${sql.identifier('user_id')} = ${value.userId}`
  return sql`CAST(${sql.identifier(column)} AS TEXT) NOT IN (${created})`
}
