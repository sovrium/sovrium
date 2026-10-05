/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A lookup through a relationship to its OWN table that reads another lookup
 * of the related row — a person's skip-level manager, read as their manager's
 * own `manager_name`.
 *
 * A self-reference joins the BASE table (a view cannot read itself — see
 * `relationFor` in `lookup-view-generators.ts`), where only stored columns
 * exist; the related row's lookup is computed in the very view being built.
 * So the value is computed from the joined row instead: the stored column the
 * chain ultimately reads, one correlated sub-select per lookup in it.
 */

import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { relatedAliasOf } from './lookup-view-helpers'
import type { Fields } from '@/domain/models/app/tables/fields'

/** How many lookups deep a chain through the table's own rows is followed. */
const MAX_SELF_LOOKUP_DEPTH = 4

type Field = Fields[number]

/** A forward lookup's two names, or `undefined` for any other field. */
const lookupOf = (
  field: Field | undefined
): { readonly relationshipField: string; readonly relatedField: string } | undefined => {
  if (field === undefined || field.type !== 'lookup') return undefined
  const { relationshipField, relatedField } = field as {
    readonly relationshipField?: unknown
    readonly relatedField?: unknown
  }
  return typeof relationshipField === 'string' && typeof relatedField === 'string'
    ? { relationshipField, relatedField }
    : undefined
}

/** Whether `name` is a many-to-one relationship of the table to itself. */
const isSelfManyToOne = (
  allFields: readonly Field[],
  name: string,
  actualTableName: string
): boolean => {
  const field = allFields.find((candidate) => candidate.name === name) as
    | { readonly type?: string; readonly relatedTable?: unknown; readonly relationType?: unknown }
    | undefined
  return (
    field?.type === 'relationship' &&
    typeof field.relatedTable === 'string' &&
    field.relationType !== 'many-to-many' &&
    sanitizeTableName(field.relatedTable) === actualTableName
  )
}

/** What `field` reads on the row `rowAlias` names — computing a lookup of the same table. */
const readOnRow = (
  field: string,
  rowAlias: string,
  context: { readonly actualTableName: string; readonly allFields: readonly Field[] },
  depth: number
): string => {
  const inner = lookupOf(context.allFields.find((candidate) => candidate.name === field))
  if (
    inner === undefined ||
    depth >= MAX_SELF_LOOKUP_DEPTH ||
    !isSelfManyToOne(context.allFields, inner.relationshipField, context.actualTableName)
  ) {
    return `${rowAlias}.${quoteSqlIdentifier(field)}`
  }
  const innerAlias = `${context.actualTableName}_self_${String(depth)}`
  const innerRead = readOnRow(inner.relatedField, innerAlias, context, depth + 1)
  return `(SELECT ${innerRead} FROM ${quoteSqlIdentifier(`${context.actualTableName}_base`)} AS ${innerAlias} WHERE ${innerAlias}.id = ${rowAlias}.${quoteSqlIdentifier(inner.relationshipField)})`
}

/**
 * The column expression of a forward lookup through the table's own rows that
 * reads another lookup of it, or `undefined` for every other lookup — which
 * then reads the joined column as before. A filtered lookup is left to the
 * ordinary path.
 */
export const readThroughSelfLookup = (
  lookupField: Field & { readonly relatedField: string; readonly filters?: unknown },
  relatedTable: string,
  context: { readonly actualTableName: string; readonly allFields: readonly Field[] }
): string | undefined => {
  if (lookupField.filters !== undefined) return undefined
  if (sanitizeTableName(relatedTable) !== context.actualTableName) return undefined
  if (
    lookupOf(context.allFields.find((field) => field.name === lookupField.relatedField)) ===
    undefined
  ) {
    return undefined
  }
  const rowAlias = relatedAliasOf(relatedTable, lookupField.name)
  return `${readOnRow(lookupField.relatedField, rowAlias, context, 0)} AS ${lookupField.name}`
}
