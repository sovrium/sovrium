/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Decode rules for a drawer's `related` sections ([internal ref] CAP-8).
 *
 * Every rule here refuses a config whose section would otherwise list NOTHING
 * in silence: a `field` that is not a relationship back to the drawer's table
 * filters on a column that can never hold the opened record's id, a `columns`
 * entry naming no field draws an empty column, and an `openDrawer` target bound
 * to another table opens on an id that belongs to a different table.
 *
 * WHY NOT A `Schema.check` ON THE ENTRY SCHEMA. Each rule needs the config's
 * `tables[]` (and the page's other drawers), which no node of the drawer schema
 * can see; and a check wrapping a node that carries an `identifier` re-keys the
 * published property universe (see `page-binding-validation.ts`). So, like the
 * other cross-table sweeps, it runs over the RAW parsed config at the one decode
 * boundary every entry point shares (`decodeAppConfigObject` →
 * `runSemanticChecks`), which is what makes boot, `sovrium validate` and the
 * watch reload reach the same verdict.
 *
 * Every message names the path (`related[0].field`), the offending value and
 * the table it was checked against, so the author can act on it unaided.
 *
 * Pure: no I/O, no schema import.
 */

import { isSystemFieldName } from '@/domain/models/app/tables/system-fields'

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** One declared table, reduced to what the rules read: its fields by name. */
type TableIndex = ReadonlyMap<string, ReadonlyMap<string, RawRecord>>

/** Index `tables[].fields[]` of a RAW config by table name, then field name. */
function indexTables(config: unknown): TableIndex {
  const tables = isRecord(config) ? config['tables'] : undefined
  if (!Array.isArray(tables)) return new Map()
  return new Map(
    tables.flatMap((table: unknown) => {
      if (!isRecord(table) || typeof table['name'] !== 'string') return []
      const fields = Array.isArray(table['fields']) ? table['fields'] : []
      const byName = new Map(
        fields.flatMap((field: unknown) =>
          isRecord(field) && typeof field['name'] === 'string'
            ? [[field['name'], field] as const]
            : []
        )
      )
      return [[table['name'], byName] as const]
    })
  )
}

/** Every object at any depth carrying `type: 'drawer'`. */
function collectDrawers(node: unknown): readonly RawRecord[] {
  if (Array.isArray(node)) return node.flatMap(collectDrawers)
  if (!isRecord(node)) return []
  const self = node['type'] === 'drawer' ? [node] : []
  return [...self, ...Object.values(node).flatMap(collectDrawers)]
}

/** The table a drawer is bound to, or `undefined` for an unbound / system drawer. */
function boundTable(drawer: RawRecord): string | undefined {
  const { dataSource } = drawer
  const table = isRecord(dataSource) ? dataSource['table'] : undefined
  return typeof table === 'string' ? table : undefined
}

/** How a message names the drawer: by its `id` when it has one. */
function drawerLabel(drawer: RawRecord): string {
  return typeof drawer['id'] === 'string' ? `drawer '${drawer['id']}'` : 'drawer'
}

/** Everything one entry's rules need to decide and to report. */
interface EntryContext {
  readonly where: string
  readonly drawerTable: string
  readonly table: string
  readonly fields: ReadonlyMap<string, RawRecord>
}

/** `field` must be a relationship column of `table` pointing at the drawer's table. */
function fieldViolations(entry: RawRecord, ctx: EntryContext): readonly string[] {
  const value = entry['field']
  if (typeof value !== 'string') return []
  const expectation = `it must be a relationship column of '${ctx.table}' pointing at the drawer's table '${ctx.drawerTable}'`
  const field = ctx.fields.get(value)
  if (field === undefined) {
    return [
      `${ctx.where}.field: '${value}' is not a column of table '${ctx.table}' — ${expectation}.`,
    ]
  }
  if (field['type'] !== 'relationship') {
    return [
      `${ctx.where}.field: '${value}' on table '${ctx.table}' is a '${String(field['type'])}' column, not a relationship — ${expectation}.`,
    ]
  }
  if (field['relatedTable'] !== ctx.drawerTable) {
    return [
      `${ctx.where}.field: '${value}' on table '${ctx.table}' points at '${String(field['relatedTable'])}', not at the drawer's table '${ctx.drawerTable}'.`,
    ]
  }
  return []
}

/** `columns[].field` and `sort[].field` must name fields of `table`. */
function fieldListViolations(
  entry: RawRecord,
  key: 'columns' | 'sort',
  ctx: EntryContext
): readonly string[] {
  const list = entry[key]
  if (!Array.isArray(list)) return []
  return list.flatMap((item: unknown, index) => {
    const value = isRecord(item) ? item['field'] : undefined
    if (typeof value !== 'string') return []
    if (ctx.fields.has(value) || isSystemFieldName(value)) return []
    return [
      `${ctx.where}.${key}[${index}].field: field '${value}' not found in table '${ctx.table}'. Available: ${[...ctx.fields.keys()].join(', ')}`,
    ]
  })
}

/** An `openDrawer` target must be a drawer on the same page bound to `table`. */
function rowClickViolations(
  entry: RawRecord,
  ctx: EntryContext,
  pageDrawers: readonly RawRecord[]
): readonly string[] {
  const { onRowClick } = entry
  if (!isRecord(onRowClick) || onRowClick['action'] !== 'openDrawer') return []
  const target = onRowClick['component']
  if (typeof target !== 'string') return []
  const drawer = pageDrawers.find((candidate) => candidate['id'] === target)
  if (drawer === undefined) {
    return [
      `${ctx.where}.onRowClick.component: no drawer with id '${target}' on this page — a related row of table '${ctx.table}' opens in a drawer bound to '${ctx.table}'.`,
    ]
  }
  const targetTable = boundTable(drawer)
  if (targetTable === ctx.table) return []
  return [
    `${ctx.where}.onRowClick.component: drawer '${target}' is bound to ${targetTable === undefined ? 'no table' : `table '${targetTable}'`}, but the rows it would open belong to table '${ctx.table}'.`,
  ]
}

/** Every refusal for one `related[index]` entry of a table-bound drawer. */
function entryViolations(args: {
  readonly entry: unknown
  readonly index: number
  readonly drawer: RawRecord
  readonly drawerTable: string
  readonly tables: TableIndex
  readonly pageDrawers: readonly RawRecord[]
}): readonly string[] {
  const { entry, index, drawer, drawerTable, tables, pageDrawers } = args
  if (!isRecord(entry) || typeof entry['table'] !== 'string') return []
  const where = `${drawerLabel(drawer)} related[${index}]`
  const { table } = entry
  const fields = tables.get(table)
  if (fields === undefined) {
    return [
      `${where}.table: table '${table}' not found. Available: ${[...tables.keys()].join(', ')}`,
    ]
  }
  const ctx: EntryContext = { where, drawerTable, table, fields }
  return [
    ...fieldViolations(entry, ctx),
    ...fieldListViolations(entry, 'columns', ctx),
    ...fieldListViolations(entry, 'sort', ctx),
    ...rowClickViolations(entry, ctx, pageDrawers),
  ]
}

/** Every refusal for one drawer, given the other drawers on its page. */
function drawerViolations(
  drawer: RawRecord,
  tables: TableIndex,
  pageDrawers: readonly RawRecord[]
): readonly string[] {
  const { related } = drawer
  if (!Array.isArray(related) || related.length === 0) return []
  const drawerTable = boundTable(drawer)
  if (drawerTable === undefined) {
    return [
      `${drawerLabel(drawer)} related: a drawer lists related records only when it is bound to a table — declare \`dataSource.table\`, since a relationship has nothing to point at otherwise.`,
    ]
  }
  return related.flatMap((entry: unknown, index) =>
    entryViolations({ entry, index, drawer, drawerTable, tables, pageDrawers })
  )
}

/**
 * Report every `related` entry on every drawer of a RAW parsed config that
 * would list nothing in silence. Empty when the config is well-formed.
 */
export function validateDrawerRelatedReferences(config: unknown): readonly string[] {
  const pages = isRecord(config) ? config['pages'] : undefined
  if (!Array.isArray(pages)) return []
  const tables = indexTables(config)
  return pages.flatMap((page: unknown) => {
    const pageDrawers = collectDrawers(page)
    return pageDrawers.flatMap((drawer) => drawerViolations(drawer, tables, pageDrawers))
  })
}
