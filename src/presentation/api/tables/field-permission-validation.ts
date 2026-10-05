/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  isFieldReadableByCaller,
  isSystemField,
} from '@/domain/models/app/tables/field-read-filter-service'
import { minMaxKindOf } from '@/domain/models/app/tables/min-max-order-service'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
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
  /** The caller's groups: a field read grant may name a group. */
  readonly userGroups: readonly string[]
  readonly c: Context
}

/**
 * May the caller read `field`? The records response's own predicate, groups
 * included — a field the response returns must stay queryable, and one it
 * strips must not.
 */
const canRead = (access: Omit<FieldAccessContext, 'c'>, field: string): boolean =>
  isFieldReadableByCaller(
    access.app,
    access.tableName,
    { role: access.userRole, groups: access.userGroups },
    field
  )

/**
 * S1 anti-enumeration: hide the field-permission boundary by returning 404
 * rather than a 403 that would confirm the field exists.
 */
function fieldPermissionDenied(c: Context) {
  return notFound(c)
}

/**
 * Whether `field` is a column a filter may name: a field the table declares, or
 * a system column. A name the table does not have is refused with the same 404
 * as a field the caller may not read, so the two cannot be told apart — and
 * before it reaches SQL, where PostgreSQL failed the query and SQLite matched
 * nothing.
 */
const isFilterableField = (app: App, tableName: string, field: string): boolean =>
  isSystemField(field) ||
  (app.tables?.find((table) => table.name === tableName)?.fields ?? []).some(
    (declared) => declared.name === field
  )

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
  access: Omit<FieldAccessContext, 'c'>,
  node: unknown
): string | undefined {
  if (Array.isArray(node)) {
    return (node as readonly unknown[])
      .map((child) => findForbiddenFilterField(access, child))
      .find((forbidden) => forbidden !== undefined)
  }
  if (typeof node !== 'object' || node === null) return undefined

  const { field, and, or } = node as UnknownFilterNode
  if (typeof field === 'string') {
    return isFilterableField(access.app, access.tableName, field) && canRead(access, field)
      ? undefined
      : field
  }
  return findForbiddenFilterField(access, and) ?? findForbiddenFilterField(access, or)
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
  if (!filter) return undefined
  if (findForbiddenFilterField(access, filter) === undefined) return undefined
  const { c } = access
  return fieldPermissionDenied(c)
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
  const { app, tableName, c } = access

  if (!groupBy) return undefined

  const fieldNames = groupBy
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
  if (fieldNames.length === 0) return undefined

  const table = app.tables?.find((t) => t.name === tableName)

  // A level the table does not have and a level the caller may not read get
  // the same 404, so the two cannot be told apart.
  const refused = fieldNames.some(
    (fieldName) =>
      !(table?.fields.some((f) => f.name === fieldName) ?? false) || !canRead(access, fieldName)
  )
  return refused ? fieldPermissionDenied(c) : undefined
}

/**
 * The first aggregated name the table does not have. It is refused as `sort`
 * refuses one, with the 404 a field the caller may not read gets — left to the
 * query it answered 400 on PostgreSQL, nothing on SQLite, and 500 on either
 * when it was not a column name at all; answered with a 400 of its own, it
 * told a hidden field from a missing one.
 */
function unknownAggregateField(
  aggregateFields: readonly string[],
  { app, tableName }: Pick<FieldAccessContext, 'app' | 'tableName'>
): string | undefined {
  const table = app.tables?.find((t) => t.name === tableName)
  return aggregateFields.find(
    (fieldName) => !isSystemField(fieldName) && !table?.fields.some((f) => f.name === fieldName)
  )
}

/**
 * The first `min`/`max` field with no order the answer could mean: `min` and
 * `max` order numbers and dates, and a field of any other kind is refused
 * rather than left out.
 */
function unorderedAggregateField(
  aggregate: AggregateParams,
  { app, tableName }: Pick<FieldAccessContext, 'app' | 'tableName'>
): string | undefined {
  return [...(aggregate.min ?? []), ...(aggregate.max ?? [])].find(
    (fieldName) => minMaxKindOf(app, tableName, fieldName) === 'refused'
  )
}

/**
 * The first `sum`/`avg` field that is not a number: they add values up, so a
 * text, a choice, a date or a lookup copying one is refused rather than
 * answered with `0` (SQLite) or a driver error (PostgreSQL). A lookup is judged
 * as the field it copies, as `min`/`max` judge it; a kind this list does not
 * know (`unknown`) is left to the query.
 */
function nonNumericAggregateField(
  aggregate: AggregateParams,
  { app, tableName }: Pick<FieldAccessContext, 'app' | 'tableName'>
): string | undefined {
  return [...(aggregate.sum ?? []), ...(aggregate.avg ?? [])].find((fieldName) => {
    const kind = minMaxKindOf(app, tableName, fieldName)
    return kind !== 'number' && kind !== 'unknown'
  })
}

/**
 * Validate aggregate parameter - ensure user has permission to read aggregated fields
 */
export function validateAggregateParam(
  aggregate: AggregateParams | undefined,
  access: FieldAccessContext
) {
  const { c } = access

  if (!aggregate) return undefined

  // Extract all field names from aggregate operations
  const aggregateFields = [
    ...(aggregate.sum ?? []),
    ...(aggregate.avg ?? []),
    ...(aggregate.min ?? []),
    ...(aggregate.max ?? []),
  ]

  // A name the table does not have and a field the caller may not read get the
  // same 404 (S1), before the shape check below can tell them apart.
  const inaccessibleField = aggregateFields.find((fieldName) => !canRead(access, fieldName))
  if (unknownAggregateField(aggregateFields, access) !== undefined || inaccessibleField) {
    return fieldPermissionDenied(c)
  }

  const nonNumeric = nonNumericAggregateField(aggregate, access)
  if (nonNumeric !== undefined) {
    const message = `\`sum\` and \`avg\` take numbers; '${nonNumeric}' is not a number`
    return c.json({ success: false, message, code: 'VALIDATION_ERROR' }, 400)
  }

  const unordered = unorderedAggregateField(aggregate, access)
  if (unordered !== undefined) {
    const message = `\`min\` and \`max\` take numbers or dates; '${unordered}' is neither`
    return c.json({ success: false, message, code: 'VALIDATION_ERROR' }, 400)
  }

  return undefined
}
