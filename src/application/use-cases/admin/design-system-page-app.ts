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
  hasCreatePermissionForRoles,
  hasDeletePermissionForRoles,
  hasUpdatePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { resolveTranslation } from '@/domain/models/app/languages/translation-resolver'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  type RowPredicate,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import { seededAccountOf, type PageDrawOptions } from './design-system-page-boards'
import { exportTextContextOf } from './design-system-page-record-text'
import { prototypeViewOf, storeTextsOf } from './design-system-page-record-view'
import { cappedSeedRows } from './design-system-page-seed'
import { appRolesOf } from './design-system-page-states'
import type { PageSeed, PageSeedAccount } from './design-system-page-seed-folder'
import type { App } from '@/domain/models/app'
import type {
  PrototypeLanguage,
  PrototypeRead,
  PrototypeStore,
} from '@/domain/models/app/design/adapters/pages/claude-design-canvas-app'
import type { Page } from '@/domain/models/app/pages'
import type { CurrentUserContext } from '@/domain/models/app/tables/row-level-evaluator-service'

type Field = Readonly<Record<string, unknown>>

/**
 * What `role` may write to `table`, as the records API's own write gates answer
 * it; a `toggle` creates and deletes, so it needs both.
 */
const tableWritesOf = (
  app: App,
  table: NonNullable<App['tables']>[number],
  role: string
): Readonly<Record<string, boolean>> => {
  const create = hasCreatePermissionForRoles(table, [role], app)
  const remove = hasDeletePermissionForRoles(table, [role], app)
  return {
    create,
    update: hasUpdatePermissionForRoles(table, [role], app),
    delete: remove,
    toggle: create && remove,
  }
}

/**
 * For each role the board may be played as, whether it may create, update and
 * delete in each table, judged by the records API's own write gates (the admin
 * override, the undeclared defaults and `inherit` included), so the board
 * offers a write exactly when the app would take it. An app without `auth`
 * gates no write.
 */
const writesOf = (app: App): PrototypeStore['writes'] =>
  app.auth === undefined
    ? undefined
    : Object.fromEntries(
        appRolesOf(app).map((role) => [
          role,
          Object.fromEntries(
            (app.tables ?? []).map((table) => [table.name, tableWritesOf(app, table, role)])
          ),
        ])
      )

/** The account a role is played as, as a row rule reads `$currentUser`. */
const rowContextOf = (
  app: App,
  role: string,
  viewer: PageSeedAccount | undefined
): CurrentUserContext => ({
  userId: viewer?.id ?? '',
  email: viewer?.email,
  role,
  isUnrestricted: isAdminEquivalent(role, app),
  assignments: new Map(),
})

/** The rows a read plan admits, as the board compares them. */
const rowsOf = (allowed: boolean, predicate: RowPredicate): PrototypeRead['rows'] => {
  if (!allowed || predicate === 'empty' || predicate === 'unresolved') return 'none'
  return predicate === 'none' || predicate === 'bypass' ? 'all' : predicate
}

/**
 * What a role may read of one table, as the records API answers it for the
 * account the role is played as (the table, row and field rules composed by
 * the read plan), or `undefined` when it reads every row and every field.
 *
 * The row rule is shipped RESOLVED: its `$currentUser` values are the played
 * account's, so the board only compares a row with a value. A rule whose
 * reader cannot be resolved (no seeded account) admits no row, as on the
 * server. A write-only field the role is told the presence of stays, drawn as
 * its specimen.
 */
const readOf = (
  app: App,
  table: TableLike,
  role: string,
  viewer: PageSeedAccount | undefined
): PrototypeRead | undefined => {
  const plan = buildReadAccessPlan({
    app,
    table,
    principal: { role, effectiveRoles: [role], isAuthenticated: true },
    policy: CANONICAL_READ_POLICY,
    rowContext: rowContextOf(app, role, viewer),
  })
  const rows = rowsOf(plan.allowed, plan.rowPredicate)
  if (rows === 'none') return { rows, hidden: [] }
  const hidden = [...plan.restrictedColumns].filter((name) => !plan.presenceColumns.has(name))
  return rows === 'all' && hidden.length === 0 ? undefined : { rows, hidden }
}

/** For each role the board may be played as, what it may read of each table it is narrowed on. */
const readsOf = (app: App, seed: PageSeed | undefined): PrototypeStore['reads'] =>
  app.auth === undefined
    ? {}
    : Object.fromEntries(
        appRolesOf(app).map((role) => [
          role,
          Object.fromEntries(
            (app.tables ?? []).flatMap((table) => {
              const read = readOf(app, table as TableLike, role, seededAccountOf(seed, role))
              return read === undefined ? [] : [[table.name, read] as const]
            })
          ),
        ])
      )

/**
 * The languages the board may be played in, for an app with several: each
 * translated text of the default language, as every other language writes it.
 */
const languageOf = (app: App): PrototypeLanguage | undefined => {
  const { languages } = app
  const codes = languages?.supported.map((language) => language.code) ?? []
  if (languages === undefined || codes.length < 2) return undefined
  const keys = [
    ...new Set(Object.values(languages.translations ?? {}).flatMap((texts) => Object.keys(texts))),
  ]
  const texts = (code: string) =>
    Object.fromEntries(
      keys.flatMap((key) => {
        const written = resolveTranslation(key, languages.default, languages)
        const translated = resolveTranslation(key, code, languages)
        return written === key || written === translated ? [] : [[written, translated] as const]
      })
    )
  return {
    codes,
    default: languages.default,
    texts: Object.fromEntries(
      codes.filter((code) => code !== languages.default).map((code) => [code, texts(code)])
    ),
  }
}

/** The address each role's sign-in leads to, as `auth.roles` declares it. */
const landingsOf = (app: App): Readonly<Record<string, string>> =>
  Object.fromEntries(
    (
      (app.auth as { readonly roles?: readonly Readonly<Record<string, unknown>>[] } | undefined)
        ?.roles ?? []
    ).flatMap((role) =>
      typeof role['defaultLanding'] === 'string'
        ? [[String(role['name']), role['defaultLanding']] as const]
        : []
    )
  )

/**
 * The store the Prototype board plays over.
 *
 * @param app - the validated config.
 * @param pages - the pages drawn, in order, each a view.
 * @param draw - the seed folder, whose rows (each table's first `SEEDED_ROW_CAP`) the store
 *   starts from, each written as the pages write it at the export's clock (`--now`).
 *   The store keeps every seeded row whatever the role: the role is a Tweak of
 *   the board, so the rows a role may not read are left out as they are drawn.
 */
export const prototypeStoreOf = (
  app: App,
  pages: readonly Page[],
  draw: PageDrawOptions | undefined
): PrototypeStore => {
  const seed = draw?.seed
  const tables = Object.fromEntries(
    Object.entries(seed?.tables ?? {}).map(([table, rows]) => [table, cappedSeedRows(rows)])
  )
  return {
    tables,
    texts: storeTextsOf(app, tables, exportTextContextOf(app, draw?.now)),
    writes: writesOf(app),
    reads: readsOf(app, seed),
    viewers: Object.fromEntries(
      appRolesOf(app).flatMap((role) => {
        const account = seededAccountOf(seed, role)
        return account === undefined ? [] : [[role, { ...account }] as const]
      })
    ),
    views: pages.map(prototypeViewOf),
    language: languageOf(app),
    landings: landingsOf(app),
  }
}

/** Every automation a button of a drawn page starts, once each, in page order. */
const startedAutomationsOf = (pages: readonly Page[]): readonly string[] => {
  const walk = (value: unknown): readonly string[] => {
    if (Array.isArray(value)) return value.flatMap(walk)
    if (typeof value !== 'object' || value === null) return []
    const node = value as Field
    const action = node['action'] as Field | undefined
    const own =
      action?.['type'] === 'automation' && typeof action['name'] === 'string'
        ? [action['name']]
        : []
    return [...own, ...Object.values(node).flatMap(walk)]
  }
  return [...new Set(pages.flatMap((page) => walk(page.components ?? [])))]
}

/**
 * One notice per form placed on a drawn page that only starts an automation,
 * and one per automation a button of a drawn page starts: the prototype runs none.
 */
export const unsimulatedNoticesOf = (app: App, pages: readonly Page[]): readonly string[] => [
  ...unsimulatedFormNoticesOf(app, pages),
  ...startedAutomationsOf(pages).map(
    (name) =>
      `Note: a button starts automation ${name}, which the Prototype board never runs: ` +
      'it shows the button pending, then its success, and the automation is not run.'
  ),
]

/** One notice per form placed on a drawn page that only starts an automation. */
const unsimulatedFormNoticesOf = (app: App, pages: readonly Page[]): readonly string[] => {
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
