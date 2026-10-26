/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { translatableFieldNamesOf } from '@/domain/models/app/tables/translatable-write-service'
import type { App } from '@/domain/models/app'
import type { Component } from '@/domain/models/app/pages/components'

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
  const dataSource = node['dataSource'] as { readonly table?: unknown } | undefined
  return typeof dataSource?.table === 'string' ? dataSource.table : undefined
}

/** Every data grid in `items` with the language its translatable fields read in. */
export const withGridRecordLanguage = (
  items: ReadonlyArray<Component | string>,
  context: GridLanguageContext
): ReadonlyArray<Component | string> => {
  const { hostApp } = context
  if (hostApp.languages === undefined) return items
  const lang = context.mounted ? hostApp.languages.default : context.lang
  const stamp = (item: Component | string): Component | string => {
    if (typeof item === 'string') return item
    const node = item as Readonly<Record<string, unknown>>
    const { children } = node
    const walked = Array.isArray(children)
      ? { ...node, children: (children as ReadonlyArray<Component | string>).map(stamp) }
      : node
    const table = gridTable(node)
    if (table === undefined || translatableFieldNamesOf(hostApp, table).length === 0) {
      return walked as Component
    }
    const dataSource = node['dataSource'] as Readonly<Record<string, unknown>>
    return { ...walked, dataSource: { ...dataSource, lang } } as Component
  }
  return items.map(stamp)
}
