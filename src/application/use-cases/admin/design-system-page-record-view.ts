/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A page as a view of the stateful prototype's Prototype board, and how a
 * routed record page's view is drawn: once, at a placeholder record, every
 * `$record.<field>` its texts read written as that field's placeholder, every
 * branch its `visibility` rules choose between drawn. The board's store fills
 * each placeholder with the record a link opens the view at, written as the
 * page writes it (`recordTextsOf`), and judges each rule against that record,
 * the address's query and the role the board is played as.
 */

import { primaryPagePath } from '@/domain/kernel/matching/localized-path'
import {
  RECORD_VIEW_ID,
  recordPlaceholderOf,
  type PrototypeStore,
  type PrototypeView,
} from '@/domain/models/app/design/adapters/pages/claude-design-canvas-app'
import { queryDefaultsOf } from './design-system-page-boards'
import { placedNodesOf } from './design-system-page-prototype'
import { recordTextsOf, type ExportTextContext } from './design-system-page-record-text'
import { recordRouteOf } from './design-system-page-records'
import type { PageSeed } from './design-system-page-seed-folder'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

type Field = Readonly<Record<string, unknown>>

/** The field types a placeholder cannot stand for: a date is drawn from a real one. */
const UNPLACEHELD_TYPES: ReadonlySet<string> = new Set([
  'date',
  'datetime',
  'time',
  'created-at',
  'updated-at',
  'deleted-at',
])

const fieldsOf = (app: App, table: string): readonly Field[] =>
  (app.tables?.find((candidate) => candidate.name === table)?.fields ?? []) as readonly Field[]

/**
 * The record a record page's view is drawn at: each field its placeholder, and
 * the field its route names it by (`id`, or a slug field) the view's own id.
 */
const placeholderRecordOf = (
  app: App,
  table: string,
  key: string
): Readonly<Record<string, unknown>> => ({
  id: RECORD_VIEW_ID,
  ...Object.fromEntries(
    fieldsOf(app, table).flatMap((field) =>
      field['writeOnly'] === true || UNPLACEHELD_TYPES.has(String(field['type']))
        ? []
        : [[String(field['name']), recordPlaceholderOf(String(field['name']))] as const]
    )
  ),
  [key]: RECORD_VIEW_ID,
})

/** The seed a record page's view is drawn from: its table holding the placeholder record only. */
export const placeholderSeedOf = (
  app: App,
  seed: PageSeed | undefined,
  table: string,
  key: string
): { readonly seed: PageSeed; readonly record: Readonly<Record<string, unknown>> } => {
  const record = placeholderRecordOf(app, table, key)
  return {
    record,
    seed: {
      dir: seed?.dir ?? '',
      tables: { ...seed?.tables, [table]: [record] },
      accounts: seed?.accounts ?? [],
      auth: seed?.auth ?? {},
      system: seed?.system ?? {},
    },
  }
}

/** A page as a view of the Prototype board: its address, and the record it reads. */
export const prototypeViewOf = (page: Page): PrototypeView => {
  const route = recordRouteOf(page)
  const visibility = Object.fromEntries(
    placedNodesOf(page).flatMap(({ id, node }) =>
      node['visibility'] === undefined ? [] : [[id, node['visibility']] as const]
    )
  )
  const query = queryDefaultsOf(page)
  return {
    page: page.name,
    path: primaryPagePath(page.path),
    ...(Object.keys(visibility).length === 0 ? {} : { visibility }),
    ...(Object.keys(query).length === 0 ? {} : { query }),
    ...(route === undefined
      ? {}
      : {
          table: route.table,
          param: route.param,
          ...(route.key === 'id' ? {} : { key: route.key }),
        }),
  }
}

/**
 * A record view's drawn page: every `$record.<field>` its texts read (a
 * `content`, a string child) written as that field's placeholder, whatever the
 * field's type, so the store writes each one from the record it is opened at.
 */
export const withRecordPlaceholders = (page: Page): Page => {
  const placeheld = (value: unknown, key: string | undefined): unknown => {
    if (typeof value === 'string') {
      return key === 'content' || key === 'child'
        ? value.replaceAll(/\$record\.(\w+)/g, (_match, field: string) =>
            recordPlaceholderOf(field)
          )
        : value
    }
    if (Array.isArray(value)) {
      return value.map((item: unknown) => placeheld(item, key === 'children' ? 'child' : undefined))
    }
    if (typeof value !== 'object' || value === null) return value
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [name, placeheld(item, name)])
    )
  }
  return { ...page, components: placeheld(page.components ?? [], undefined) } as Page
}

/**
 * Each seeded row's fields that a page writes differently from what is
 * stored, by table, row id and field: the stored value, and its text.
 */
export const storeTextsOf = (
  app: App,
  tables: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>,
  context: ExportTextContext
): NonNullable<PrototypeStore['texts']> =>
  Object.fromEntries(
    Object.entries(tables).map(([table, rows]) => [
      table,
      Object.fromEntries(
        rows.flatMap((row) => {
          const texts = Object.entries(recordTextsOf(app.tables ?? [], table, row, context))
            .map(([field, text]) => [field, [String(row[field]), text] as const] as const)
            .filter(([, [stored, text]]) => stored !== text)
          return texts.length === 0 ? [] : [[String(row['id']), Object.fromEntries(texts)] as const]
        })
      ),
    ])
  )
