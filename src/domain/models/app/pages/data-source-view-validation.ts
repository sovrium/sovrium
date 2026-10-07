/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Cross-config validation of `dataSource.view` — a page component reading
 * through one of its table's declared views.
 *
 * `view` sits on the SHARED data source schema, so every data-bound component
 * type decodes it, while only the nine components that read a table's records
 * — `table`, `kanban`, `calendar`, `gallery`, `list`, `chart`, `kpi`, `map`,
 * `tree` — read through it. Four refusals follow, each because the alternative is a binding
 * that silently serves more (or other) than its author meant:
 *
 *  - a view that the bound table does not declare, by id or by name — the
 *    component would fall back to nothing an author wrote;
 *  - `view` beside a system read endpoint — a system source has no table, so it
 *    has no views (the decode already refuses the key on that variant; this
 *    keeps the refusal if the variant ever widens);
 *  - `view` on any other component — a form writes, and an ignored `view` would
 *    serve the whole table to a reader the author meant to narrow;
 *  - `filter`, `sort` or `fields` beside `view` — the view owns those, and two
 *    sources of truth for one rule means one of them silently loses. The
 *    message names the view the condition belongs on.
 *
 * A binding whose TABLE does not resolve is left to the table-name rule, which
 * already names it; a `$param.<name>` table is resolved per request and cannot
 * be checked here. Runs inside `decodeAppConfigObject`, so `validate`, `start`
 * and `build` reach the same verdict.
 */

import { findViewByKey } from '@/domain/models/app/tables/views/view-read-service'

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null

/** The component types that read a table's records, and so may read them through a view. */
const VIEW_READER_TYPES: ReadonlySet<string> = new Set([
  'table',
  'kanban',
  'calendar',
  'gallery',
  'list',
  'chart',
  'kpi',
  'map',
  'tree',
])

/** What a view decides for every component bound to it, refused beside `view`. */
const VIEW_OWNED_KEYS = ['filter', 'sort', 'fields'] as const

interface DeclaredView {
  readonly id: string | number
  readonly name: string
}

/** Each declared table name, with the views it declares. */
const collectDeclaredViews = (config: unknown): ReadonlyMap<string, readonly DeclaredView[]> => {
  const tables = isRecord(config) ? config['tables'] : undefined
  if (!Array.isArray(tables)) return new Map()
  return new Map(
    tables.flatMap((table: unknown) => {
      if (!isRecord(table) || typeof table['name'] !== 'string') return []
      const views = Array.isArray(table['views'])
        ? table['views'].filter(
            (view: unknown): view is DeclaredView =>
              isRecord(view) &&
              (typeof view['id'] === 'string' || typeof view['id'] === 'number') &&
              typeof view['name'] === 'string'
          )
        : []
      return [[table['name'], views] as const]
    })
  )
}

/** One `dataSource.view` found in the config, and where. */
interface ViewBinding {
  readonly surface: string
  readonly type: string | undefined
  readonly source: Readonly<Record<string, unknown>>
  readonly view: string
}

/**
 * The view bindings ONE node carries: its own `dataSource`, and the one inside
 * its `props` bag when it declares a `type` (several shipped grids nest their
 * whole config there). The bag is then skipped by the walk, so one binding is
 * reported once.
 */
const bindingsOn = (
  node: Readonly<Record<string, unknown>>,
  path: string
): readonly ViewBinding[] => {
  const type = typeof node['type'] === 'string' ? node['type'] : undefined
  const surface = type ?? path
  const props = type !== undefined && isRecord(node['props']) ? node['props'] : undefined
  return [node['dataSource'], props?.['dataSource']].flatMap((source) =>
    isRecord(source) && typeof source['view'] === 'string'
      ? [{ surface, type, source, view: source['view'] }]
      : []
  )
}

const collectViewBindings = (
  node: unknown,
  path: string,
  parentTyped: boolean
): readonly ViewBinding[] => {
  if (Array.isArray(node)) {
    return node.flatMap((element, index) =>
      collectViewBindings(element, `${path}[${index}]`, false)
    )
  }
  if (!isRecord(node)) return []
  const typed = typeof node['type'] === 'string'
  return [
    ...(parentTyped && path.endsWith('.props') ? [] : bindingsOn(node, path)),
    ...Object.entries(node).flatMap(([key, value]) =>
      collectViewBindings(value, path === '' ? key : `${path}.${key}`, typed)
    ),
  ]
}

/** The refusal for one binding, or `undefined` when it resolves. */
const checkBinding = (
  binding: ViewBinding,
  declared: ReadonlyMap<string, readonly DeclaredView[]>
): string | undefined => {
  const at = `${binding.surface}.dataSource.view`
  if (binding.source['system'] !== undefined) {
    return `${at}: a system read endpoint has no table, so it has no views — remove \`view\` or bind a table`
  }
  if (binding.type === undefined || !VIEW_READER_TYPES.has(binding.type)) {
    return `${at}: only a component that reads records (table, kanban, calendar, gallery, list, chart, kpi, map, tree) reads through a view — remove \`view\` from this ${binding.type ?? 'binding'}`
  }
  const repeated = VIEW_OWNED_KEYS.find((key) => binding.source[key] !== undefined)
  if (repeated !== undefined) {
    return `${binding.surface}.dataSource.${repeated}: the view '${binding.view}' owns the ${repeated} of every component bound to it — declare it on the view '${binding.view}' instead, or bind the table directly without \`view\``
  }
  const { table } = binding.source
  if (typeof table !== 'string') return undefined
  const views = declared.get(table)
  if (views === undefined) return undefined
  if (findViewByKey(views, binding.view)) return undefined
  const available = views.map((view) => String(view.id)).join(', ') || '(none)'
  return `${at}: View '${binding.view}' not found on table '${table}'. Available: ${available}`
}

/**
 * Report every `dataSource.view` that names no declared view, or sits where no
 * view can be read.
 */
export function validateDataSourceViewReferences(config: unknown): readonly string[] {
  const declared = collectDeclaredViews(config)
  return collectViewBindings(config, '', false).flatMap((binding) => {
    const refusal = checkBinding(binding, declared)
    return refusal === undefined ? [] : [refusal]
  })
}
