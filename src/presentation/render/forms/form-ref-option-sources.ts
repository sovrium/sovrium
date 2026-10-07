/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Read the table-backed choices of every form a page embeds by `formRef`.
 *
 * `expandFormRefs` renders an embedded form synchronously, inside the
 * component-filter pass, so the rows it needs are read BEFORE that pass and
 * handed to it — the same choices, from the same planner, as the form's own
 * route serves (`resolveFormOptionSources`). Only top-level `form` / `dialog`
 * embeddings are expanded, so only those are read, and an embedding hidden
 * from this session is skipped: it will not be on the page.
 *
 * A filter's `$currentUser` reference resolves against the host page's
 * session through the shared resolver; one that cannot resolve makes that ONE
 * source offer no choices — fail closed, never the unfiltered list. The rows
 * are read through the page's records gate with the form's authority over the
 * table and the visitor's row-level rule (`readRowsForCaller`).
 */

import {
  accountChoiceSets,
  collectFormOptionSources,
  collectFormUserColumns,
  MAX_ACCOUNT_CHOICES,
  optionSourceQuery,
  rowsToOptions,
  type FormOptionItem,
  type FormOptionSets,
  type FormOptionSourcePlan,
} from '@/domain/models/app/forms/form-option-source-service'
import { readEmbeddedFormRef } from '@/domain/models/app/pages/embedded-form-ref'
import { collectFromComponentTree } from '@/presentation/render/resolve/component-walker'
import { resolveFilters, scopeTablesOf } from '@/presentation/render/resolve/current-user-resolver'
import { readRowsForCaller } from '@/presentation/render/resolve/record-read-gate'
import { isComponentHiddenForSession } from '@/presentation/render/resolve/visibility-filter'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'

/** The choices each embedded form reads, keyed by form name. */
export type FormRefOptionSets = Readonly<Record<string, FormOptionSets>>

/** What reading the rows needs about the request. */
export interface FormRefOptionSourceContext {
  readonly app: App
  readonly db: DataSourceDb
  readonly session: SessionInfo | undefined
  readonly cookies: Readonly<Record<string, string>> | undefined
}

/** Every `formRef` this page embeds and shows to this session, once per embed. */
const embeddedFormRefs = (
  components: Page['components'],
  session: SessionInfo | undefined,
  app: App
): readonly string[] =>
  collectFromComponentTree(components ?? [], {
    visit: (node) => {
      const formRef = readEmbeddedFormRef(node)
      return formRef === undefined ? [] : [formRef]
    },
    shouldSkip: (node) => isComponentHiddenForSession(node, session, app),
  })

/** The form names this page embeds by `formRef` and shows to this session. */
export const embeddedFormNames = (
  components: Page['components'],
  session: SessionInfo | undefined,
  app: App
): readonly string[] => [...new Set(embeddedFormRefs(components, session, app))]

/** The form names this page embeds more than once — their controls need scoped ids. */
export const repeatedFormNames = (
  components: Page['components'],
  session: SessionInfo | undefined,
  app: App
): ReadonlySet<string> => {
  const refs = embeddedFormRefs(components, session, app)
  return new Set(refs.filter((name, index) => refs.indexOf(name) !== index))
}

/** Read ONE plan's rows and project them into choices. */
async function readPlan(
  plan: FormOptionSourcePlan,
  ctx: FormRefOptionSourceContext
): Promise<readonly [string, readonly FormOptionItem[]]> {
  const filters = await resolveFilters(plan.source.filter, {
    session: ctx.session,
    cookies: ctx.cookies,
    fetchAssignments: ctx.db.fetchUserAssignments,
    scopeTables: scopeTablesOf(ctx.app),
  })
  if (filters.kind === 'unauthorized') return [plan.field, []]
  const query = optionSourceQuery({ ...plan.source, filter: filters.filter })
  // The form's authority over the table, the visitor's row-level rule — the
  // same read the form's own route makes (`resolveFormOptionSources`).
  const { rows } = await readRowsForCaller({
    app: ctx.app,
    tableName: query.table,
    session: ctx.session,
    db: ctx.db,
    query: query.options,
    authority: 'form',
  })
  return [plan.field, rowsToOptions(rows, plan.source)]
}

/**
 * The accounts each `user` field of `form` offers: none to an anonymous
 * visitor (a page does not publish the account directory), and no read when
 * the form has no such field.
 */
async function readAccountChoices(
  form: NonNullable<App['forms']>[number],
  ctx: FormRefOptionSourceContext
): Promise<FormOptionSets> {
  const columns = collectFormUserColumns(form, ctx.app.tables ?? [])
  if (columns.length === 0 || ctx.session === undefined || !ctx.db.fetchAccountChoices) return {}
  const accounts = await ctx.db.fetchAccountChoices(MAX_ACCOUNT_CHOICES)
  return accountChoiceSets(
    columns,
    accounts.map((account) => ({ value: account.id, label: account.label }))
  )
}

/**
 * Read the choices of every form `components` embeds. A page embedding no
 * form, or only forms whose choices are written in the config, runs no query.
 */
export async function resolveFormRefOptionSets(
  components: Page['components'],
  ctx: FormRefOptionSourceContext
): Promise<FormRefOptionSets> {
  const forms = embeddedFormNames(components, ctx.session, ctx.app).flatMap((name) => {
    const form = ctx.app.forms?.find((candidate) => candidate.name === name)
    return form === undefined ? [] : [form]
  })
  const entries = await Promise.all(
    forms.map(async (form) => {
      const plans = collectFormOptionSources(form, ctx.app.tables ?? [])
      const sets = await Promise.all(plans.map((plan) => readPlan(plan, ctx)))
      const accounts = await readAccountChoices(form, ctx)
      return [form.name, { ...Object.fromEntries(sets), ...accounts } as FormOptionSets] as const
    })
  )
  return Object.fromEntries(entries.filter(([, sets]) => Object.keys(sets).length > 0))
}
