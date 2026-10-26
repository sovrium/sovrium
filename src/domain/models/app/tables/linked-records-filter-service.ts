/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A condition on a `many-to-many` relationship, read through its links.
 *
 * A many-to-many field keeps no column on its table: its links are rows of a
 * link table. A condition naming it was compiled against a column that does
 * not exist, so it matched no row on SQLite and was refused on PostgreSQL. The
 * condition is rewritten here into one the records query compiles against the
 * link table: a row matches when ANY of its links does.
 *
 * - `equals` and `in` take linked-record ids and keep the rows linked to one.
 * - `notEquals` keeps the rows with no link to the id, rows with no link at all
 *   included.
 * - A link the reader may not read (`toManyLinksRefusedTo`) is left out of her
 *   records whole, so an id condition reads it as empty: `equals` and `in`
 *   match nothing, `notEquals` matches every row. Matching through it would
 *   tell her which of her rows link to a record she may not see.
 * - `contains`, `startsWith` and `endsWith` take text and keep the rows linked
 *   to a record whose display field matches it, under the related-value rule
 *   every other door shares (`mayReadRelatedField`). A reader that rule does
 *   not admit matches nothing by name; so does any reader short of an admin on
 *   a related table with row-level rules, since matching through a row she may
 *   not read would tell her its name.
 */

import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import {
  mayReadRelatedField,
  toManyLinksRefusedTo,
  type RelatedReader,
} from './related-field-read-service'
import { deriveFieldLinkTableName } from './table-derived-name-validation'
import type { App } from '@/domain/models/app'

/** The operator a rewritten condition carries; its `field` is the relationship. */
export const LINKED_RECORDS_OPERATOR = 'matchesLinkedRecords'

const ID_OPERATORS = ['equals', 'in', 'notEquals'] as const
const TEXT_OPERATORS = ['contains', 'startsWith', 'endsWith'] as const

/** What a rewritten condition carries. */
export type LinkedRecordsValue =
  | {
      readonly operator: (typeof ID_OPERATORS)[number]
      /** The table holding the field, the table it links to, and the field's link table. */
      readonly sourceTable: string
      readonly relatedTable: string
      readonly linkTable: string
      /** The linked-record ids compared, as text. */
      readonly ids: readonly string[]
    }
  | {
      readonly operator: (typeof TEXT_OPERATORS)[number]
      readonly sourceTable: string
      readonly relatedTable: string
      readonly linkTable: string
      readonly text: string
      /** The related field a reader sees a linked record by. */
      readonly displayField: string
      /** Whether the reader may match by that field; `false` matches nothing by name. */
      readonly readable: boolean
    }

const isOneOf = <T extends string>(values: readonly T[], candidate: unknown): candidate is T =>
  typeof candidate === 'string' && (values as readonly string[]).includes(candidate)

/** Whether a filter value is a rewritten many-to-many condition. */
export const isLinkedRecordsValue = (value: unknown): value is LinkedRecordsValue => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Readonly<Record<string, unknown>>
  if (typeof candidate['sourceTable'] !== 'string') return false
  if (typeof candidate['relatedTable'] !== 'string') return false
  if (typeof candidate['linkTable'] !== 'string') return false
  if (isOneOf(ID_OPERATORS, candidate['operator'])) return Array.isArray(candidate['ids'])
  return (
    isOneOf(TEXT_OPERATORS, candidate['operator']) &&
    typeof candidate['text'] === 'string' &&
    typeof candidate['displayField'] === 'string' &&
    typeof candidate['readable'] === 'boolean'
  )
}

type Table = NonNullable<App['tables']>[number]
type Field = Table['fields'][number]

/** The table a many-to-many field links to, or `undefined` for any other field. */
const manyToManyTargetOf = (app: App, field: Field | undefined): Table | undefined => {
  if (field?.type !== 'relationship') return undefined
  const { relatedTable, relationType } = field as {
    readonly relatedTable?: string
    readonly relationType?: string
  }
  if (relationType !== 'many-to-many') return undefined
  return app.tables?.find((table) => table.name === relatedTable)
}

/** The two tables a many-to-many `field` of `table` joins, and its link table. */
const endsOf = (table: Table, field: string, related: Table) => ({
  sourceTable: table.name,
  relatedTable: related.name,
  linkTable: deriveFieldLinkTableName(table, { name: field, relatedTable: related.name }),
})

/** A condition's value as linked-record ids: a list, or one id. */
const idsOf = (value: unknown): readonly string[] | undefined => {
  const items = Array.isArray(value) ? value : [value]
  return items.every((item) => typeof item === 'string' || typeof item === 'number')
    ? items.map(String)
    : undefined
}

/** A text condition rewritten against the linked records' display field. */
const textLeaf = (
  leaf: { readonly field: unknown; readonly operator: (typeof TEXT_OPERATORS)[number] },
  value: unknown,
  context: { readonly app: App; readonly reader: RelatedReader; readonly table: Table },
  related: Table
): Readonly<Record<string, unknown>> | undefined => {
  const { app, reader, table } = context
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const displayField = (
    table.fields.find((candidate) => candidate.name === leaf.field) as {
      readonly displayField?: string
    }
  )?.displayField
  if (displayField === undefined) return undefined
  const rowsOpen = isAdminEquivalent(reader.role, app) || related.rowLevelPermissions === undefined
  const readable = rowsOpen && mayReadRelatedField(app, reader, related.name, displayField)
  const ends = endsOf(table, String(leaf.field), related)
  const rewritten = {
    operator: leaf.operator,
    ...ends,
    text: String(value),
    displayField,
    readable,
  }
  return { field: leaf.field, operator: LINKED_RECORDS_OPERATOR, value: rewritten }
}

/** One condition rewritten through the links, or `undefined` to keep it. */
const rewriteLeaf = (
  leaf: Readonly<Record<string, unknown>>,
  context: { readonly app: App; readonly reader: RelatedReader; readonly table: Table }
): Readonly<Record<string, unknown>> | undefined => {
  const { field, operator, value } = leaf
  const related = manyToManyTargetOf(
    context.app,
    context.table.fields.find((candidate) => candidate.name === field)
  )
  if (related === undefined) return undefined
  if (isOneOf(TEXT_OPERATORS, operator))
    return textLeaf({ field, operator }, value, context, related)
  if (!isOneOf(ID_OPERATORS, operator)) return undefined
  const ids = idsOf(value)
  if (ids === undefined) return undefined
  const ends = endsOf(context.table, String(field), related)
  const withheld = toManyLinksRefusedTo(context.app, context.table.name, context.reader).has(
    String(field)
  )
  const compared = withheld ? [] : ids
  return { field, operator: LINKED_RECORDS_OPERATOR, value: { operator, ...ends, ids: compared } }
}

/**
 * Rewrite every condition on a many-to-many field of `tableName` into one read
 * through its links, through `and` / `or` groups. Every other node is returned
 * as it came.
 */
export function withLinkedRecordsConditions<T>(
  filter: T,
  context: { readonly app: App; readonly tableName: string; readonly reader: RelatedReader }
): T {
  const { app, tableName, reader } = context
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  if (table === undefined) return filter
  const rewrite = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(rewrite)
    if (typeof node !== 'object' || node === null) return node
    const record = node as Readonly<Record<string, unknown>>
    if (!('operator' in record)) {
      return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, rewrite(child)]))
    }
    return rewriteLeaf(record, { app, reader, table }) ?? node
  }
  return rewrite(filter) as T
}
