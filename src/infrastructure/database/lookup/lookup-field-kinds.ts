/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which fields make a table view-backed, and the names that follow from it:
 * the lookup / rollup / count field guards, `shouldUseView`, the `_base`
 * storage name and the tables a view body reads.
 *
 * Split out of `lookup-view-generators.ts`, which re-exports the public names.
 */

import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'
import type { ViewFilterNode } from '@/domain/models/app/tables/views/filters'

export type LookupFieldInput = Fields[number] & {
  readonly type: 'lookup'
  readonly relationshipField: string
  readonly relatedField: string
  readonly filters?: ViewFilterNode
}

/**
 * Check if a field is a lookup field
 */
export const isLookupField = (field: Fields[number]): field is LookupFieldInput =>
  field.type === 'lookup' &&
  'relationshipField' in field &&
  'relatedField' in field &&
  typeof field.relationshipField === 'string' &&
  typeof field.relatedField === 'string'

/**
 * Check if a field is a rollup field
 */
export const isRollupField = (
  field: Fields[number]
): field is Fields[number] & {
  type: 'rollup'
  relationshipField: string
  relatedField: string
  aggregation: string
  filters?: ViewFilterNode
} =>
  field.type === 'rollup' &&
  'relationshipField' in field &&
  'relatedField' in field &&
  'aggregation' in field &&
  typeof field.relationshipField === 'string' &&
  typeof field.relatedField === 'string' &&
  typeof field.aggregation === 'string'

/**
 * Check if a field is a count field
 */
export const isCountField = (
  field: Fields[number]
): field is Fields[number] & {
  type: 'count'
  relationshipField: string
  filters?: ViewFilterNode
} =>
  field.type === 'count' &&
  'relationshipField' in field &&
  typeof field.relationshipField === 'string'

/**
 * Check if a table has any lookup fields
 */
export const hasLookupFields = (table: Table): boolean =>
  table.fields.some((field) => isLookupField(field))

/**
 * Check if a table has any rollup fields
 */
export const hasRollupFields = (table: Table): boolean =>
  table.fields.some((field) => isRollupField(field))

/**
 * Check if a table has any count fields
 */
export const hasCountFields = (table: Table): boolean =>
  table.fields.some((field) => isCountField(field))

/**
 * The set of OTHER table names that a table's generated VIEW BODY reads from.
 *
 * A `lookup` field JOINs to its relationship's related table; a `rollup`/`count`
 * field subqueries `FROM <relatedTable>` (the VIEW name, not the base table).
 * When any of those related tables is ALSO view-backed, the referencing VIEW
 * must be created AFTER the referenced VIEW — on Postgres the referenced
 * relation must already exist at `CREATE VIEW` time, or schema-init fails with
 * `relation "<name>" does not exist`. This is the dependency signal that
 * orders view creation (see `sortTablesByViewDependencies`).
 *
 * Returns raw config table names (matching `table.name`), so callers can filter
 * against the view-backed set directly.
 */
export const getViewBodyReferencedTables = (
  table: Table,
  allTables: readonly Table[]
): ReadonlySet<string> => {
  const referenced = table.fields.flatMap((field) => {
    if (isRollupField(field) || isCountField(field) || isLookupField(field)) {
      const relationshipFieldDef = table.fields.find((f) => f.name === field.relationshipField)
      if (
        relationshipFieldDef &&
        relationshipFieldDef.type === 'relationship' &&
        'relatedTable' in relationshipFieldDef &&
        typeof relationshipFieldDef.relatedTable === 'string'
      ) {
        return [relationshipFieldDef.relatedTable]
      }
      // Reverse lookup: the FK lives on another table whose relationship field
      // points back here — the view JOINs to that other table.
      if (isLookupField(field)) {
        const reverse = allTables.find(
          (t) =>
            t.name !== table.name &&
            t.fields.some((f) => f.name === field.relationshipField && f.type === 'relationship')
        )
        return reverse ? [reverse.name] : []
      }
    }
    return []
  })
  // A self-reference reads the base table (`relationFor`), not this view.
  return new Set(referenced.filter((name) => name !== table.name))
}

/**
 * Generate base table name for a table with lookup fields
 * The actual table is named {table}_base, and the VIEW is named {table}
 */
export const getBaseTableName = (tableName: string): string => `${tableName}_base`

/**
 * Check if a table should use a VIEW (has lookup, rollup, or count fields)
 */
export const shouldUseView = (table: Table): boolean =>
  hasLookupFields(table) || hasRollupFields(table) || hasCountFields(table)

/**
 * The physical relation that holds a table's rows.
 *
 * A view-backed table (see {@link shouldUseView}) stores its rows in
 * `<name>_base` behind a `<name>` VIEW; every other table IS its own relation.
 * Every DDL statement that changes STORAGE — `ALTER TABLE`, a constraint, an
 * index, a trigger, a catalog probe — must address this name, never the config
 * name: `ALTER TABLE <view>` is not a statement any engine accepts, and reading
 * the view's columns would count its computed fields as stored ones.
 *
 * The config name stays the right key for everything the OPERATOR sees
 * (messages, the previous-schema snapshot, rename detection), because nothing
 * in the config says `_base`.
 */
export const getPhysicalTableName = (table: Table): string => {
  const sanitized = sanitizeTableName(table.name)
  return shouldUseView(table) ? getBaseTableName(sanitized) : sanitized
}
