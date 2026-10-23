/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the stateful prototype (`--prototype=app`) is drawn from: the store its
 * Prototype board plays over, seeded from the rows the export drew (the seed
 * folder's, every secret already drawn as its specimen); the record each
 * routed record page's view is drawn at, every field a placeholder the store
 * fills in; and the forms it answers without simulating, because all they do
 * is start an automation, which the prototype never runs.
 */

import {
  RECORD_VIEW_ID,
  recordPlaceholderOf,
  type PrototypeStore,
  type PrototypeView,
} from '@/domain/models/app/design/adapters/pages/claude-design-canvas-app'
import { recordSourceOf, seededAccountOf } from './design-system-page-boards'
import { cappedSeedRows } from './design-system-page-seed'
import { appRolesOf } from './design-system-page-states'
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

/** The record a record page's view is drawn at: each field its placeholder. */
const placeholderRecordOf = (app: App, table: string): Readonly<Record<string, unknown>> => ({
  id: RECORD_VIEW_ID,
  ...Object.fromEntries(
    fieldsOf(app, table).flatMap((field) =>
      field['writeOnly'] === true || UNPLACEHELD_TYPES.has(String(field['type']))
        ? []
        : [[String(field['name']), recordPlaceholderOf(String(field['name']))] as const]
    )
  ),
})

/** The seed a record page's view is drawn from: its table holding the placeholder record only. */
export const placeholderSeedOf = (
  app: App,
  seed: PageSeed | undefined,
  table: string
): { readonly seed: PageSeed; readonly record: Readonly<Record<string, unknown>> } => {
  const record = placeholderRecordOf(app, table)
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
  const source = recordSourceOf(page)
  return {
    page: page.name,
    path: page.path,
    ...(source === undefined ? {} : { table: source.table, param: source.param }),
  }
}

/** Each table's write rules, as the config writes them. */
const permissionsOf = (app: App): PrototypeStore['permissions'] =>
  Object.fromEntries(
    (app.tables ?? []).map((table) => {
      const rules = ((table as { readonly permissions?: Field }).permissions ?? {}) as Field
      return [
        table.name,
        Object.fromEntries(
          ['create', 'update', 'delete'].flatMap((operation) =>
            rules[operation] === undefined ? [] : [[operation, rules[operation]] as const]
          )
        ),
      ]
    })
  )

/**
 * The store the Prototype board plays over.
 *
 * @param app - the validated config.
 * @param pages - the pages drawn, in order, each a view.
 * @param seed - the seed folder, whose rows (each table's first `SEEDED_ROW_CAP`) the store starts from.
 */
export const prototypeStoreOf = (
  app: App,
  pages: readonly Page[],
  seed: PageSeed | undefined
): PrototypeStore => ({
  tables: Object.fromEntries(
    Object.entries(seed?.tables ?? {}).map(([table, rows]) => [table, cappedSeedRows(rows)])
  ),
  permissions: permissionsOf(app),
  viewers: Object.fromEntries(
    appRolesOf(app).flatMap((role) => {
      const account = seededAccountOf(seed, role)
      return account === undefined ? [] : [[role, { ...account }] as const]
    })
  ),
  views: pages.map(prototypeViewOf),
})

/** One notice per form placed on a drawn page that only starts an automation. */
export const unsimulatedFormNoticesOf = (app: App, pages: readonly Page[]): readonly string[] => {
  const placed = new Set(
    pages.flatMap((page) =>
      [...JSON.stringify(page.components ?? []).matchAll(/"formRef":"([^"]+)"/g)].map(
        (match) => match[1] ?? ''
      )
    )
  )
  return (app.forms ?? []).flatMap((form) => {
    const submitTo = (form as { readonly submitTo?: Field }).submitTo ?? {}
    return placed.has(form.name) &&
      submitTo['automation'] !== undefined &&
      submitTo['table'] === undefined
      ? [
          `Note: form ${form.name} only starts an automation, which the Prototype board ` +
            'never runs: it answers with its message and is not simulated.',
        ]
      : []
  })
}
