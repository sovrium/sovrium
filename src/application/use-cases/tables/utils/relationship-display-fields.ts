/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure derivation of which relationship columns can show a human label, and of
 * the label block a read surface renders from.
 *
 * A relationship column stores the related row's identifier. A field declaring
 * `displayField` has already named the column that identifies that row to a
 * person, so a read surface has everything it needs — except the join. This
 * module says which columns qualify, which identifiers a page of records
 * references, and how the resolved labels attach to each record.
 *
 * The stored identifier is never replaced. It stays exactly where it was, so
 * filters, sorting, the editors and every write path keep seeing the key they
 * store; the labels ride alongside under `_display`, which read surfaces
 * consult and everything else ignores.
 */

import type { App } from '@/domain/models/app'

type SchemaField = {
  readonly name?: unknown
  readonly type?: unknown
  readonly relatedTable?: unknown
  readonly displayField?: unknown
}

/** A relationship column that declared the column identifying its target. */
export interface RelationshipDisplaySpec {
  readonly fieldName: string
  readonly relatedTable: string
  readonly displayField: string
}

/** Per-record labels: field name → the label(s) behind its stored key(s). */
export type RecordDisplayLabels = Record<string, string | readonly string[]>

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

/** Does `table` declare a field called `fieldName`? */
const tableDeclares = (tables: App['tables'], table: string, fieldName: string): boolean =>
  tables?.find((t) => t.name === table)?.fields.some((f) => f.name === fieldName) === true

/**
 * The relationship columns on `tableName` whose target can be labelled.
 *
 * A column is included only when the table it points at really declares the
 * named column. A typo therefore falls back to showing the identifier — the
 * behaviour before any of this existed — instead of failing the whole list
 * request, which is the wrong price for a misspelling in config.
 */
export const getRelationshipDisplaySpecs = (
  tables: App['tables'],
  tableName: string
): readonly RelationshipDisplaySpec[] => {
  const table = tables?.find((t) => t.name === tableName)
  if (!table) return []
  return table.fields.flatMap((raw): readonly RelationshipDisplaySpec[] => {
    const field = raw as SchemaField
    if (field.type !== 'relationship') return []
    if (!isNonEmptyString(field.name)) return []
    if (!isNonEmptyString(field.relatedTable)) return []
    if (!isNonEmptyString(field.displayField)) return []
    if (!tableDeclares(tables, field.relatedTable, field.displayField)) return []
    return [
      {
        fieldName: field.name,
        relatedTable: field.relatedTable,
        displayField: field.displayField,
      },
    ]
  })
}

/** The stored key(s) a single relationship cell references, if any. */
const keysOf = (value: unknown): readonly (string | number)[] => {
  if (Array.isArray(value)) {
    return value.filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
  }
  if (typeof value === 'string' && value.length > 0) return [value]
  if (typeof value === 'number') return [value]
  return []
}

/**
 * Every identifier a page of records references, per (table, column) pair.
 *
 * Collapsed across records and across columns so two columns pointing at the
 * same table through the same display column resolve in one query rather than
 * two — and so the read stays one query per pair however many rows are listed.
 */
export const collectReferencedKeys = (
  specs: readonly RelationshipDisplaySpec[],
  records: readonly { readonly fields: Readonly<Record<string, unknown>> }[]
): readonly { relatedTable: string; displayField: string; ids: readonly (string | number)[] }[] => {
  const byPair = specs.reduce<Record<string, readonly (string | number)[]>>((acc, spec) => {
    const key = `${spec.relatedTable}.${spec.displayField}`
    const ids = records.flatMap((record) => keysOf(record.fields[spec.fieldName]))
    return { ...acc, [key]: [...(acc[key] ?? []), ...ids] }
  }, {})

  return Object.entries(byPair).flatMap(([key, ids]) => {
    const [relatedTable = '', displayField = ''] = key.split('.')
    const unique = [...new Set(ids)]
    return unique.length === 0 ? [] : [{ relatedTable, displayField, ids: unique }]
  })
}

/**
 * The `_display` block for one record, or `undefined` when it references
 * nothing that resolved.
 *
 * A key whose row has since been deleted keeps its identifier rather than
 * vanishing: a dangling link should stay visible as a link, and dropping it
 * would also change how many entries a to-many cell renders.
 */
export const buildRecordDisplayLabels = (
  specs: readonly RelationshipDisplaySpec[],
  fields: Readonly<Record<string, unknown>>,
  labels: Readonly<Record<string, Readonly<Record<string, string>>>>
): RecordDisplayLabels | undefined => {
  const entries = specs.flatMap((spec): readonly (readonly [string, string | string[]])[] => {
    const byId = labels[`${spec.relatedTable}.${spec.displayField}`]
    if (!byId) return []
    const raw = fields[spec.fieldName]
    const keys = keysOf(raw)
    if (keys.length === 0) return []
    const resolved = keys.map((key) => byId[String(key)] ?? String(key))
    // Preserve the cell's shape: a to-one column labels to a string, a to-many
    // column to a list, so a renderer can tell one pill from many without
    // re-reading the schema.
    return [[spec.fieldName, Array.isArray(raw) ? resolved : (resolved[0] ?? String(keys[0]))]]
  })
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}
