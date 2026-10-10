/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { withoutAdminOnlyFields } from '@/domain/models/app/tables/field-read-filter-service'
import { hydratedFieldIdOf, withHydratedId } from './hydrated-field-reference'
import { reverseCollectionFields, singleRelationshipFields } from './record-trigger-relations'
import type { App } from '@/domain/models/app'

/**
 * The rows a record trigger hands its run, after expansion: the row after the
 * event and, on an update, the row before it.
 */
export interface RecordTriggerRows {
  readonly record: Readonly<Record<string, unknown>>
  readonly previousRecord?: Readonly<Record<string, unknown>>
}

const isValueMap = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * An expanded related row without its table's admin-only fields, and its
 * reverse row (one level deeper) without the child table's. Rebuilt with
 * `withHydratedId`, not spread: the prototype is what makes the field read as
 * the id it stores.
 */
const withoutAdminOnlyRelatedFields = (
  app: App,
  relatedTable: string,
  related: Readonly<Record<string, unknown>>,
  id: string
): Readonly<Record<string, unknown>> => {
  const reverseRows = reverseCollectionFields(app, relatedTable)
    .filter(({ field }) => isValueMap(related[field]))
    .map(
      ({ field, relatedTable: childTable }) =>
        [
          field,
          withoutAdminOnlyFields(app, childTable, related[field] as Record<string, unknown>),
        ] as const
    )
  const columns = {
    ...withoutAdminOnlyFields(app, relatedTable, related),
    ...Object.fromEntries(reverseRows),
  }
  return withHydratedId(columns, id)
}

/** One row of `tableName` without the admin-only fields of its own table or of the rows it expands. */
const withoutAdminOnlyRowFields = (
  app: App,
  tableName: string,
  row: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const relatedRows = singleRelationshipFields(app, tableName).flatMap(
    ({ field, relatedTable }) => {
      const value = row[field]
      const id = hydratedFieldIdOf(value)
      return id === undefined || !isValueMap(value)
        ? []
        : [[field, withoutAdminOnlyRelatedFields(app, relatedTable, value, id)] as const]
    }
  )
  return { ...withoutAdminOnlyFields(app, tableName, row), ...Object.fromEntries(relatedRows) }
}

/**
 * The trigger data without a single field kept for admins alone: not in the
 * row that changed, not in the row before an update, not in an expanded related
 * row (judged by the related table's rules), not in its reverse row (the child
 * table's). Whoever made the write: the run is read by admins, approvers and
 * every destination a step writes to, never by the writer as such.
 */
export const withoutAdminOnlyTriggerFields = (
  app: App,
  tableName: string,
  rows: RecordTriggerRows
): RecordTriggerRows => {
  const record = withoutAdminOnlyRowFields(app, tableName, rows.record)
  return rows.previousRecord === undefined
    ? { record }
    : { record, previousRecord: withoutAdminOnlyRowFields(app, tableName, rows.previousRecord) }
}
