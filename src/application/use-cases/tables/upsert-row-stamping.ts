/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isGuestSession, SYSTEM_USER_ID } from '@/domain/models/app/auth/guest-session'
import {
  buildCreateAuthorshipOverrides,
  buildCurrentUserDefaults,
  createdByFieldNames,
} from '@/domain/models/app/tables/authorship-fields'
import { storedValuesIn } from '@/domain/models/app/tables/user-list-field-service'
import type { App } from '@/domain/models/app'

/**
 * The `$currentUser` defaults an upsert may write as insert-only: those no row
 * of the batch supplies itself. Empty for a guest or the system actor, who is
 * no person.
 *
 * Insert-only is what makes a default fill the rows the upsert CREATES and never
 * the rows it updates, so a matched row keeps the person it already names. A
 * default some row supplies explicitly is left to the rows as written, because
 * insert-only is batch-wide and would drop that row's own value from its update.
 */
const upsertCurrentUserDefaults = (
  userId: string,
  tables: App['tables'],
  tableName: string,
  recordsData: readonly Record<string, unknown>[]
): Readonly<Record<string, string>> => {
  if (isGuestSession(userId) || userId === SYSTEM_USER_ID) return {}
  const defaults = buildCurrentUserDefaults(tables, tableName, userId, {})
  return Object.fromEntries(
    Object.entries(defaults).filter(([name]) =>
      recordsData.every(
        (fields) => fields[name] === undefined || fields[name] === null || fields[name] === ''
      )
    )
  )
}

/**
 * An upsert's rows as it writes them, and the columns it writes on insert only.
 * Every `created-by`/`updated-by`-typed field is stamped BY
 * NAME, as the single-record create does (`write-record-programs.ts`): the
 * infra only fills the literal `created_by`/`updated_by` columns, and the
 * create half of an upsert must satisfy a NOT NULL author column like any
 * other create. The created-by names, plus the intrinsic
 * `created_at`/`created_by`, are insert-only: a matched row keeps its original
 * author and creation date.
 */
export const stampUpsertRows = (
  userId: string,
  app: App | undefined,
  tableName: string,
  recordsData: readonly Record<string, unknown>[]
): {
  readonly recordsData: readonly Record<string, unknown>[]
  readonly insertOnlyFields: readonly string[]
} => {
  const tables = app?.tables
  const overrides = isGuestSession(userId)
    ? {}
    : buildCreateAuthorshipOverrides(tables, tableName, userId)
  const rows = recordsData.map((fields) => storedValuesIn(tables, tableName, fields))
  const defaults = upsertCurrentUserDefaults(userId, tables, tableName, rows)
  return {
    recordsData: rows.map((fields) => ({ ...fields, ...overrides, ...defaults })),
    insertOnlyFields: [
      'created_at',
      'created_by',
      ...createdByFieldNames(tables, tableName),
      ...Object.keys(defaults),
    ],
  }
}
