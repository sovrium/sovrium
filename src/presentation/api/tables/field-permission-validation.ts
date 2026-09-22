/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SELECTABLE_SYSTEM_FIELDS } from '@/application/use-cases/tables/list-helpers'
import { isFieldReadableByRole } from '@/domain/models/app/tables/field-read-filter-service'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

type AggregateParams = {
  readonly count?: boolean
  readonly sum?: readonly string[]
  readonly avg?: readonly string[]
  readonly min?: readonly string[]
  readonly max?: readonly string[]
}

/**
 * The three shapes a filter node can take, read structurally rather than by
 * type. The walker below is handed raw `JSON.parse` output from `?filter=` as
 * well as the typed `FilterStructure` the other entry points build, so it
 * narrows on the properties it finds instead of trusting a declared type.
 */
type UnknownFilterNode = {
  readonly field?: unknown
  readonly and?: unknown
  readonly or?: unknown
}

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
 * The first field in `node` this role may not read, or `undefined` when every
 * referenced field is readable.
 *
 * `FilterNode` is RECURSIVE (`row-level-read-helpers.ts`) and the SQL builder
 * walks the whole tree, so this check has to as well. A flat-leaf-only version
 * is escaped by one level of nesting: `{and:[{or:[{field:'salary',…}]}]}` has no
 * `field` at the top, an undeclared field permission is OPEN, and the identical
 * predicate that answers 404 flat answers 200 wrapped.
 *
 * `unknown` rather than `FilterStructure` on purpose — the `?filter=` entry
 * point is a bare `JSON.parse`, so the declared type is a claim about this
 * value, not a fact about it.
 */
function findForbiddenFilterField(
  app: App,
  tableName: string,
  userRole: string,
  node: unknown
): string | undefined {
  if (Array.isArray(node)) {
    return (node as readonly unknown[])
      .map((child) => findForbiddenFilterField(app, tableName, userRole, child))
      .find((forbidden) => forbidden !== undefined)
  }
  if (typeof node !== 'object' || node === null) return undefined

  const { field, and, or } = node as UnknownFilterNode
  if (typeof field === 'string') {
    return isFieldReadableByRole(app, tableName, userRole, field) ? undefined : field
  }
  return (
    findForbiddenFilterField(app, tableName, userRole, and) ??
    findForbiddenFilterField(app, tableName, userRole, or)
  )
}

/**
 * Validate a CALLER-SUPPLIED filter — ensure the role may read every field it
 * references. 404 rather than 403 per S1: a field the caller cannot read must
 * be indistinguishable from one that does not exist.
 *
 * ⚠️ Hand this the RAW request filter, never the merged one. `buildListFilter`
 * AND-merges the row-level READ PREDICATE — a clause the SERVER wrote to
 * constrain this caller — onto the caller's filter. Validating that tree checks
 * the server's own scoping column against the scoped caller's read permission,
 * which inverts the guarantee: partitioning a table by tenant and hiding the
 * tenant column then EMPTIES the table instead of scoping it, on a plain list
 * with no filter in the request at all. The `?q=` search group is likewise
 * server-derived (`buildSearchFilter` only ever names readable columns).
 */
export function validateFilterParam(filter: unknown, access: FieldAccessContext) {
  const { app, tableName, userRole, c } = access

  if (!filter) return undefined
  if (findForbiddenFilterField(app, tableName, userRole, filter) === undefined) return undefined
  return fieldPermissionDenied(c)
}

/**
 * Validate fields parameter - ensure all requested field names exist in the table
 *
 * The accepted system names come from {@link SELECTABLE_SYSTEM_FIELDS}, the
 * same set the selection itself reads. This gate previously allowed `id`
 * alone while `applyFieldSelection` served `id`, `createdAt` and `updatedAt`,
 * so `?fields=id,createdAt` was refused with a 400 by the layer in front of the
 * one that could answer it. Two vocabularies for one question is what made that
 * possible, so there is now one.
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

  const invalidField = requestedFields.find(
    (fieldName) => !SELECTABLE_SYSTEM_FIELDS.has(fieldName) && !tableFieldNames.has(fieldName)
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
