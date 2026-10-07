/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Cross-config validation of the table source of a `graph` or `matrix`.
 *
 * Every name in `dataSource.nodes[]` and `dataSource.edges[]` is a table, view
 * or field name of the app, and a wrong one draws nothing at all — an empty
 * service map reads exactly like an app with no services. So each is resolved
 * against `tables[]` when the config is read:
 *
 *  - a node entry's `table` must be declared, its `view` declared on it, and
 *    `labelField`, `idField`, `groupField` and `stateField` fields of it;
 *  - a link-table edge's `table` must be declared, its `fromField` and
 *    `toField` relationship fields of it, and `kindField`, `opsField` and
 *    `flagField` fields of it;
 *  - a field edge's `<table>.<field>` must name a relationship field of a
 *    declared table.
 *
 * Runs inside `decodeAppConfigObject`, so `validate`, `start` and `build`
 * reach the same verdict.
 */

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null

/** What this rule reads of one declared table. */
interface DeclaredTable {
  readonly fields: ReadonlyMap<string, string>
  readonly views: readonly { readonly id: string; readonly name: string }[]
}

const declaredTables = (config: unknown): ReadonlyMap<string, DeclaredTable> => {
  const tables = isRecord(config) && Array.isArray(config['tables']) ? config['tables'] : []
  return new Map(
    tables.flatMap((table: unknown) => {
      if (!isRecord(table) || typeof table['name'] !== 'string') return []
      const fields = Array.isArray(table['fields']) ? table['fields'] : []
      const views = Array.isArray(table['views']) ? table['views'] : []
      return [
        [
          table['name'],
          {
            fields: new Map(
              fields.flatMap((field: unknown) =>
                isRecord(field) && typeof field['name'] === 'string'
                  ? [[field['name'], String(field['type'] ?? '')] as const]
                  : []
              )
            ),
            views: views.flatMap((view: unknown) =>
              isRecord(view) && typeof view['name'] === 'string'
                ? [{ id: String(view['id'] ?? ''), name: view['name'] }]
                : []
            ),
          },
        ] as const,
      ]
    })
  )
}

/** Every `{ nodes: [...] }` data source of a `graph` or `matrix`, with where it sits. */
const collectTableSources = (
  node: unknown,
  path: string
): readonly { readonly at: string; readonly source: Readonly<Record<string, unknown>> }[] => {
  if (Array.isArray(node)) {
    return node.flatMap((child, index) => collectTableSources(child, `${path}[${index}]`))
  }
  if (!isRecord(node)) return []
  const own =
    (node['type'] === 'graph' || node['type'] === 'matrix') &&
    isRecord(node['dataSource']) &&
    Array.isArray(node['dataSource']['nodes'])
      ? [{ at: `${String(node['type'])}.dataSource`, source: node['dataSource'] }]
      : []
  return [
    ...own,
    ...Object.entries(node).flatMap(([key, value]) =>
      collectTableSources(value, path === '' ? key : `${path}.${key}`)
    ),
  ]
}

/** The refusals for the optional field keys an entry names on `table`. */
const missingFields = (
  entry: Readonly<Record<string, unknown>>,
  keys: readonly string[],
  ctx: { readonly at: string; readonly tableName: string; readonly table: DeclaredTable }
): readonly string[] =>
  keys.flatMap((key) => {
    const name = entry[key]
    if (typeof name !== 'string' || name === 'id' || ctx.table.fields.has(name)) return []
    return [`${ctx.at}.${key}: field '${name}' not found on table '${ctx.tableName}'`]
  })

const checkNode = (
  entry: unknown,
  at: string,
  tables: ReadonlyMap<string, DeclaredTable>
): readonly string[] => {
  if (!isRecord(entry) || typeof entry['table'] !== 'string') return []
  const tableName = entry['table']
  const table = tables.get(tableName)
  if (table === undefined) return [`${at}.table: table '${tableName}' is not declared in tables`]
  const { view } = entry
  const viewRefusal =
    typeof view === 'string' && !table.views.some((v) => v.id === view || v.name === view)
      ? [`${at}.view: view '${view}' not found on table '${tableName}'`]
      : []
  return [
    ...viewRefusal,
    ...missingFields(entry, ['labelField', 'idField', 'groupField', 'stateField'], {
      at,
      tableName,
      table,
    }),
  ]
}

const checkEdge = (
  entry: unknown,
  at: string,
  tables: ReadonlyMap<string, DeclaredTable>
): readonly string[] => {
  if (!isRecord(entry)) return []
  if (typeof entry['from'] === 'string') {
    const [tableName = '', field = ''] = entry['from'].split('.')
    const table = tables.get(tableName)
    if (table === undefined) return [`${at}.from: table '${tableName}' is not declared in tables`]
    return table.fields.get(field) === 'relationship'
      ? []
      : [`${at}.from: '${field}' is not a relationship field of table '${tableName}'`]
  }
  if (typeof entry['table'] !== 'string') return []
  const tableName = entry['table']
  const table = tables.get(tableName)
  if (table === undefined) return [`${at}.table: table '${tableName}' is not declared in tables`]
  const ends = ['fromField', 'toField'].flatMap((key) => {
    const name = entry[key]
    return typeof name === 'string' && table.fields.get(name) !== 'relationship'
      ? [`${at}.${key}: '${name}' is not a relationship field of table '${tableName}'`]
      : []
  })
  return [
    ...ends,
    ...missingFields(entry, ['kindField', 'opsField', 'flagField'], { at, tableName, table }),
  ]
}

/** Report every name of a graph or matrix table source that the app does not declare. */
export function validateGraphTablesSources(config: unknown): readonly string[] {
  const tables = declaredTables(config)
  return collectTableSources(config, '').flatMap(({ at, source }) => [
    ...(source['nodes'] as readonly unknown[]).flatMap((entry, index) =>
      checkNode(entry, `${at}.nodes[${index}]`, tables)
    ),
    ...(Array.isArray(source['edges']) ? source['edges'] : []).flatMap(
      (entry: unknown, index: number) => checkEdge(entry, `${at}.edges[${index}]`, tables)
    ),
  ])
}
