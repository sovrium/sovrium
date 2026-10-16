/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A text condition on a relationship field, read against the LINKED record.
 *
 * A many-to-one relationship stores the linked row's id, so `project contains
 * "atla"` compared the text with an id and matched nothing: a reader typing a
 * project's name could not find the records linked to it. The condition is
 * rewritten here into one the records query compiles against the related
 * table's `displayField` — the name a reader sees in the grid and the picker.
 *
 * The rewrite answers to the related-value rule every other door shares: the
 * related table and its display field must admit the reader
 * (`mayReadRelatedField`). A reader they do not admit matches nothing by name.
 * On a related table with row-level rules, any reader short of an admin
 * matches by name only the related rows the rule admits her: the condition is
 * marked `ruled`, and the list carries the rule projected for her
 * ({@link withRelatedTextRules}). A ruled condition that carries no rule
 * matches nothing by name — matching through a row she may not read would
 * tell her its name.
 *
 * `equals` keeps its stored-id meaning — a choice picked from a list sends the
 * id — and matches an exact display name besides.
 */

import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import { mayReadRelatedField, type RelatedReader } from './related-field-read-service'
import type { App } from '@/domain/models/app'

/** The operator a rewritten condition carries; its `field` is the relationship column. */
export const RELATED_TEXT_OPERATOR = 'matchesRelatedText'

/** The text operators read against the linked record. */
export type RelatedTextOperator = 'contains' | 'startsWith' | 'endsWith' | 'equals'

const RELATED_TEXT_OPERATORS: ReadonlySet<string> = new Set([
  'contains',
  'startsWith',
  'endsWith',
  'equals',
])

/** What a rewritten condition carries. */
export interface RelatedTextValue {
  readonly operator: RelatedTextOperator
  readonly text: string
  /** The related table, and the field of it a reader sees the linked record by. */
  readonly table: string
  readonly displayField: string
  /** Whether the reader may match by that field; `false` matches nothing by name. */
  readonly readable: boolean
  /** The related table's row rule governs this reader: only the rows it admits match by name. */
  readonly ruled?: boolean
  /** That rule, projected for the reader as a filter node over the related table. */
  readonly rule?: unknown
}

/** Whether a filter value is a rewritten related-text condition. */
export const isRelatedTextValue = (value: unknown): value is RelatedTextValue => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Readonly<Record<string, unknown>>
  return (
    typeof candidate['operator'] === 'string' &&
    RELATED_TEXT_OPERATORS.has(candidate['operator']) &&
    typeof candidate['text'] === 'string' &&
    typeof candidate['table'] === 'string' &&
    typeof candidate['displayField'] === 'string' &&
    typeof candidate['readable'] === 'boolean'
  )
}

type Field = NonNullable<NonNullable<App['tables']>[number]['fields']>[number]

/** The related table and display field of a relationship that stores the linked id. */
function linkTargetOf(app: App, field: Field | undefined) {
  if (field?.type !== 'relationship') return undefined
  const { relatedTable, displayField, relationType } = field as {
    readonly relatedTable?: string
    readonly displayField?: string
    readonly relationType?: string
  }
  if (relationType === 'many-to-many' || relationType === 'one-to-many') return undefined
  const related = app.tables?.find((table) => table.name === relatedTable)
  if (related === undefined || displayField === undefined) return undefined
  if (!related.fields.some((candidate) => candidate.name === displayField)) return undefined
  return { related, displayField }
}

/** One condition rewritten against the linked record, or `undefined` to keep it. */
function rewriteLeaf(
  leaf: Readonly<Record<string, unknown>>,
  context: { readonly app: App; readonly reader: RelatedReader; readonly fields: readonly Field[] }
): Readonly<Record<string, unknown>> | undefined {
  const { app, reader, fields } = context
  const { field, operator, value } = leaf
  if (typeof operator !== 'string' || !RELATED_TEXT_OPERATORS.has(operator)) return undefined
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const target = linkTargetOf(
    app,
    fields.find((candidate) => candidate.name === field)
  )
  if (target === undefined) return undefined
  const rowsOpen =
    isAdminEquivalent(reader.role, app) || target.related.rowLevelPermissions === undefined
  const rewritten: RelatedTextValue = {
    operator: operator as RelatedTextOperator,
    text: String(value),
    table: target.related.name,
    displayField: target.displayField,
    readable: mayReadRelatedField(app, reader, target.related.name, target.displayField),
    ...(rowsOpen ? {} : { ruled: true }),
  }
  return { field, operator: RELATED_TEXT_OPERATOR, value: rewritten }
}

/**
 * Rewrite every text condition on a relationship field of `tableName` into a
 * related-text condition, through `and` / `or` groups. Every other node is
 * returned as it came.
 */
export function withRelatedTextConditions<T>(
  filter: T,
  context: { readonly app: App; readonly tableName: string; readonly reader: RelatedReader }
): T {
  const { app, tableName, reader } = context
  const fields = app.tables?.find((table) => table.name === tableName)?.fields ?? []
  const rewrite = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(rewrite)
    if (typeof node !== 'object' || node === null) return node
    const record = node as Readonly<Record<string, unknown>>
    if (!('operator' in record)) {
      return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, rewrite(child)]))
    }
    return rewriteLeaf(record, { app, reader, fields }) ?? node
  }
  return rewrite(filter) as T
}

/** Every node of a filter tree, through `and` / `or` groups, rewritten by `leaf`. */
const mapLeaves = (node: unknown, leaf: (record: Readonly<Record<string, unknown>>) => unknown) => {
  const walk = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(walk)
    if (typeof current !== 'object' || current === null) return current
    const record = current as Readonly<Record<string, unknown>>
    if ('operator' in record) return leaf(record)
    return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, walk(child)]))
  }
  return walk(node)
}

/** The ruled related-text value a leaf carries, if any. */
const ruledValueOf = (leaf: Readonly<Record<string, unknown>>): RelatedTextValue | undefined =>
  leaf['operator'] === RELATED_TEXT_OPERATOR &&
  isRelatedTextValue(leaf['value']) &&
  leaf['value'].ruled === true &&
  leaf['value'].readable
    ? leaf['value']
    : undefined

/** Every leaf of a filter tree, through `and` / `or` groups. */
const leavesOf = (node: unknown): ReadonlyArray<Readonly<Record<string, unknown>>> => {
  if (Array.isArray(node)) return node.flatMap(leavesOf)
  if (typeof node !== 'object' || node === null) return []
  const record = node as Readonly<Record<string, unknown>>
  return 'operator' in record ? [record] : Object.values(record).flatMap(leavesOf)
}

/** The related tables whose row rule a filter's link-name conditions answer to, each once. */
export function ruledRelatedTablesIn(filter: unknown): readonly string[] {
  const tables = leavesOf(filter).flatMap((leaf) => {
    const ruled = ruledValueOf(leaf)
    return ruled === undefined ? [] : [ruled.table]
  })
  return [...new Set(tables)]
}

/**
 * `filter` with each ruled link-name condition carrying its related table's
 * rule from `rules` (table name → the rule projected for the reader). A table
 * `rules` does not name is left without one, and matches nothing by name.
 */
export function withRelatedTextRules<T>(filter: T, rules: ReadonlyMap<string, unknown>): T {
  return mapLeaves(filter, (leaf) => {
    const ruled = ruledValueOf(leaf)
    const rule = ruled === undefined ? undefined : rules.get(ruled.table)
    return ruled === undefined || rule === undefined ? leaf : { ...leaf, value: { ...ruled, rule } }
  }) as T
}
