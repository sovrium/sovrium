/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { translatableFieldNamesOf } from '@/domain/models/app/tables/translatable-write-service'
import {
  componentFields,
  entryAsComponent,
  keyOf,
  rewriteComponent,
  type ComponentEntry,
} from '@/presentation/render/resolve/component-rewrite'
import type { App } from '@/domain/models/app'

/**
 * The language a data grid — or a kanban, gallery or list bound to a table —
 * reads its translatable fields in, stamped on its `dataSource` as `lang` so
 * it asks for it (`?lang=`) rather than leave it to the reader's browser.
 *
 * - On the mounted operator console: the app's DEFAULT language, whatever the
 *   operator's browser prefers — the console shows the default language.
 * - On a page: the page's own language, the one its `$t:` keys resolve in.
 *
 * Only a component bound to a table holding a translatable field is stamped;
 * every other component's request is left exactly as it was.
 */

/** Whom the pass reads the tables and languages from, and in which language the page reads. */
interface GridLanguageContext {
  readonly hostApp: App
  readonly mounted: boolean
  readonly lang: string
}

/** The component types that fetch records from a table: the grid, and the card and row views. */
const RECORD_FETCHING_TYPES: ReadonlySet<unknown> = new Set(['table', 'kanban', 'gallery', 'list'])

/** The table a record-fetching component is bound to, when it is bound to one. */
const gridTable = (node: Readonly<Record<string, unknown>>): string | undefined => {
  if (!RECORD_FETCHING_TYPES.has(node['type'])) return undefined
  const table = keyOf(node['dataSource'], 'table')
  return typeof table === 'string' ? table : undefined
}

/** Every data grid in `items` with the language its translatable fields read in. */
export const withGridRecordLanguage = (
  items: ReadonlyArray<ComponentEntry>,
  context: GridLanguageContext
): ReadonlyArray<ComponentEntry> => {
  const { hostApp } = context
  if (hostApp.languages === undefined) return items
  const lang = context.mounted ? hostApp.languages.default : context.lang
  const stamp = (item: ComponentEntry): ComponentEntry => {
    if (typeof item === 'string') return item
    const component = entryAsComponent(item)
    const node = componentFields(component)
    const { children } = node
    const walked = Array.isArray(children)
      ? rewriteComponent(component, {
          children: (children as ReadonlyArray<ComponentEntry>).map(stamp),
        })
      : component
    const table = gridTable(node)
    if (table === undefined || translatableFieldNamesOf(hostApp, table).length === 0) {
      return walked
    }
    const dataSource = node['dataSource'] as Readonly<Record<string, unknown>>
    return rewriteComponent(walked, { dataSource: { ...dataSource, lang } })
  }
  return items.map(stamp)
}
