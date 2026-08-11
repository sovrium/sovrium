/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isFieldReadableByRole } from '@/application/use-cases/tables/utils/field-read-filter'
import type { FilterStructure, FilterLeaf, FilterNode } from '../record/row-level-read-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

type AggregateParams = {
  readonly count?: boolean
  readonly sum?: readonly string[]
  readonly avg?: readonly string[]
  readonly min?: readonly string[]
  readonly max?: readonly string[]
}

const isFilterLeaf = (node: FilterNode): node is FilterLeaf =>
  'field' in node && typeof node.field === 'string'

/**
 * Everything a field-read check needs. `app` + `tableName` (rather than a
 * pre-resolved table) is deliberate: the canonical predicate needs the whole
 * app to resolve admin-equivalence and the table's `permissions.fields`, and a
 * narrowed `{ fields }` shape structurally cannot carry either.
 */
type FieldAccessContext = {
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly c: Context
}

/**
 * S1 anti-enumeration: hide the field-permission boundary by returning 404
 * rather than a 403 that would confirm the field exists.
 */
function fieldPermissionDenied(c: Context) {
  return c.json(
    {
      success: false,
      message: 'Resource not found',
      code: 'NOT_FOUND',
    },
    404
  )
}

/**
 * Validate filter parameter - ensure user has permission to read filter fields
 */
export function validateFilterParam(filter: FilterStructure, access: FieldAccessContext) {
  const { app, tableName, userRole, c } = access

  if (!filter) return undefined

  // Extract field names from filter structure. Only flat leaf clauses carry
  // a `field` to validate; nested AND/OR groups (composite row-level
  // predicates) never reach this request-filter validation path.
  const filterFields = filter.and?.filter(isFilterLeaf).map((leaf) => leaf.field) ?? []

  // Check if user has permission to read each filter field using find instead of for loop
  const inaccessibleField = filterFields.find(
    (fieldName) => !isFieldReadableByRole(app, tableName, userRole, fieldName)
  )

  if (inaccessibleField) return fieldPermissionDenied(c)

  return undefined
}

/**
 * Validate fields parameter - ensure all requested field names exist in the table
 */
export function validateFieldsParam(
  fields: string | undefined,
  table:
    { readonly fields: readonly { readonly name: string; readonly type: string }[] } | undefined,
  c: Context
) {
  if (!fields) return undefined

  const requestedFields = fields.split(',').map((f) => f.trim())
  const tableFieldNames = new Set(table?.fields.map((f) => f.name) ?? [])
  // id is always a valid system field regardless of schema fields
  const systemFields = new Set(['id'])

  const invalidField = requestedFields.find(
    (fieldName) => !systemFields.has(fieldName) && !tableFieldNames.has(fieldName)
  )

  if (invalidField) {
    return c.json(
      {
        success: false,
        message: `Invalid field name: '${invalidField}'`,
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }

  return undefined
}

/**
 * Validate groupBy parameter - ensure the field exists and the user has permission to read it.
 *
 * Mirrors validateAggregateParam: without this check a user could enumerate distinct values of
 * a hidden field via `?groupBy=hiddenField`. This is the same class of bypass PR #264 fixed for
 * the filter parameter (`?filter=field:value`).
 *
 * `groupBy` may name several NESTED levels as a comma-separated list
 * (`region,stage,owner`). Every one of them is a field the reader might not be
 * allowed to read, and every one of them reaches the reader as a group header,
 * so each level is checked. Checking only the first would leave the enumeration
 * bypass open one level down — `?groupBy=region,salary` would answer with a
 * header per distinct salary.
 */
export function validateGroupByParam(groupBy: string | undefined, access: FieldAccessContext) {
  const { app, tableName, userRole, c } = access

  if (!groupBy) return undefined

  const fieldNames = groupBy
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
  if (fieldNames.length === 0) return undefined

  const table = app.tables?.find((t) => t.name === tableName)

  // Ensure every named field exists on the table (400 if not)
  const unknownField = fieldNames.find(
    (fieldName) => !(table?.fields.some((f) => f.name === fieldName) ?? false)
  )
  if (unknownField !== undefined) {
    return c.json(
      {
        success: false,
        message: `Invalid groupBy field: '${unknownField}'`,
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }

  if (fieldNames.some((fieldName) => !isFieldReadableByRole(app, tableName, userRole, fieldName))) {
    return fieldPermissionDenied(c)
  }

  return undefined
}

/**
 * Validate aggregate parameter - ensure user has permission to read aggregated fields
 */
export function validateAggregateParam(
  aggregate: AggregateParams | undefined,
  access: FieldAccessContext
) {
  const { app, tableName, userRole, c } = access

  if (!aggregate) return undefined

  // Extract all field names from aggregate operations
  const aggregateFields = [
    ...(aggregate.sum ?? []),
    ...(aggregate.avg ?? []),
    ...(aggregate.min ?? []),
    ...(aggregate.max ?? []),
  ]

  // Check if user has permission to read each aggregated field using find instead of for loop
  const inaccessibleField = aggregateFields.find(
    (fieldName) => !isFieldReadableByRole(app, tableName, userRole, fieldName)
  )

  if (inaccessibleField) return fieldPermissionDenied(c)

  return undefined
}
