/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Read the choices a hosted form's fields take from tables, for one render.
 *
 * The rows are read with the FORM's authority: no read-access plan is run for
 * the visitor, because a public form's visitor may read no table at all, and
 * that is the case this exists for. The exposure is bounded where it can be
 * checked once — at load (`form-option-source-validation.ts`) — and here the
 * read projects only the two named columns. A row-level read rule is narrower
 * and is the visitor's: it says which rows each reader may see, and a choice is
 * a row, so the source offers only the rows the rule shows this visitor —
 * signed in or not, as the records API answers her.
 *
 * A filter's `$currentUser.<id|email|role>` reference is resolved against the
 * signed-in visitor. Any reference that cannot be resolved (nobody signed in,
 * an assignment scope, a route segment a form URL does not have) makes that
 * ONE source offer no choices — fail closed, never the unfiltered list.
 *
 * A field bound to a `user` column offers the app's accounts, named by their
 * label, to a SIGNED-IN visitor only — a public form does not publish the
 * account directory. The directory is read once per render, bounded, whatever
 * the number of user fields.
 */

import { Effect } from 'effect'
import {
  AuthRepository,
  type AuthDatabaseError,
} from '@/application/ports/repositories/auth/auth-repository'
import {
  DataSourceRepository,
  type DataSourceDatabaseError,
} from '@/application/ports/repositories/tables/data-source-repository'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
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
  type OptionSourceQuery,
} from '@/domain/models/app/forms/form-option-source-service'
import { normalizeCurrentUserRef } from '@/domain/models/app/pages/current-user-ref'
import {
  admittedWindow,
  visitorRowRule,
  type RowRuleReader,
} from '@/domain/models/app/tables/visitor-row-rule-service'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { SelectOptionSource } from '@/domain/models/app/table-option-source'

/** What a form render knows about the visitor, keyed like `$currentUser.<name>`. */
export type FormOptionVisitor = Readonly<Record<string, unknown>>

export interface ResolveFormOptionSourcesInput {
  readonly app: App
  readonly form: Form
  /** The signed-in visitor (`id`, and `email` / `role` when known); absent for anyone else. */
  readonly visitor?: FormOptionVisitor | undefined
}

type Filter = NonNullable<SelectOptionSource['filter']>[number]

/**
 * Substitute ONE filter value, or `undefined` when it holds a reference this
 * render cannot resolve.
 */
const resolveFilterValue = (
  value: Filter['value'],
  visitor: FormOptionVisitor | undefined
): Filter['value'] | undefined => {
  const ref = normalizeCurrentUserRef(value)
  if (ref === undefined) {
    const isOtherReference = typeof value === 'object' && value !== null && !Array.isArray(value)
    return isOtherReference ? undefined : value
  }
  if (ref.path.kind !== 'scalar') return undefined
  const resolved = visitor?.[ref.path.name]
  return typeof resolved === 'string' ? resolved : undefined
}

/** The source with every reference substituted, or `undefined` when one cannot be. */
export const resolveSourceFilter = (
  source: SelectOptionSource,
  visitor: FormOptionVisitor | undefined
): SelectOptionSource | undefined => {
  if (source.filter === undefined || source.filter.length === 0) return source
  const filter = source.filter.map((entry) => ({
    ...entry,
    value: resolveFilterValue(entry.value, visitor),
  }))
  if (filter.some((entry) => entry.value === undefined)) return undefined
  return { ...source, filter: filter as SelectOptionSource['filter'] }
}

/** The visitor as the row-level rule reads her; `undefined` for anyone not signed in. */
const readerOf = (visitor: FormOptionVisitor | undefined, app: App): RowRuleReader | undefined => {
  const id = visitor?.['id']
  if (typeof id !== 'string') return undefined
  const email = visitor?.['email']
  const role = typeof visitor?.['role'] === 'string' ? visitor['role'] : ''
  return {
    userId: id,
    role,
    // The app's top role reads every row, as the built-in `admin` does.
    isUnrestricted: isAdminEquivalent(role, app),
    ...(typeof email === 'string' ? { email } : {}),
  }
}

/** The reader's `user_access` record ids for each scope table a rule reads. */
const loadAssignments = (reader: RowRuleReader | undefined, scopeTables: readonly string[]) =>
  Effect.gen(function* () {
    if (reader === undefined || scopeTables.length === 0) {
      return new Map<string, readonly string[]>()
    }
    const repo = yield* DataSourceRepository
    const entries = yield* Effect.forEach(scopeTables, (slug) =>
      repo.fetchUserAssignments(reader.userId, slug).pipe(Effect.map((ids) => [slug, ids] as const))
    )
    return new Map<string, readonly string[]>(entries)
  })

/**
 * The rows of ONE choice source the visitor may be offered: the form's own
 * authority over the table, under the table's row-level read rule for the
 * visitor — signed in or not (`visitorRowRule`, the rule every server-side
 * read of rows answers). A rule is judged on whole rows, so a source under one
 * reads every matching row, then keeps the admitted ones up to its limit.
 *
 * This is the ONE gated read of a form's choices: the choice list draws from
 * it, and a submitted link is judged by it (`submit-form-offered-links.ts`),
 * so a row the rule withholds is neither offered nor accepted.
 */
export const readAdmittedSourceRows = (
  app: App,
  query: OptionSourceQuery,
  visitor: FormOptionVisitor | undefined
) =>
  Effect.gen(function* () {
    const repo = yield* DataSourceRepository
    const table = app.auth ? app.tables?.find((t) => t.name === query.table) : undefined
    const reader = readerOf(visitor, app)
    const rule = visitorRowRule(table, reader)
    if (rule.kind === 'all') return yield* repo.fetchRecords(query.table, query.options)
    if (rule.kind === 'none') return []
    const { fields, pageSize, ...whole } = query.options
    const rows = yield* repo.fetchRecords(query.table, whole)
    const assignments = yield* loadAssignments(reader, rule.scopeTables)
    const verdicts = rows.map((row) => rule.admits(row, assignments))
    return admittedWindow(rows, verdicts, { fields, pageSize }).rows
  }).pipe(
    Effect.withSpan('forms.read-admitted-source-rows', { attributes: { table: query.table } })
  )

/** Read ONE plan's rows and project them into choices. */
const readPlan = (app: App, plan: FormOptionSourcePlan, visitor: FormOptionVisitor | undefined) =>
  Effect.gen(function* () {
    const source = resolveSourceFilter(plan.source, visitor)
    if (source === undefined) return [plan.field, [] as readonly FormOptionItem[]] as const
    const rows = yield* readAdmittedSourceRows(app, optionSourceQuery(source), visitor)
    return [plan.field, rowsToOptions(rows, source)] as const
  })

/**
 * The accounts each `user` field of `form` offers: none to an anonymous
 * visitor, and no read at all when the form has no such field.
 */
const readAccountChoices = (input: ResolveFormOptionSourcesInput) =>
  Effect.gen(function* () {
    const columns = collectFormUserColumns(input.form, input.app.tables ?? [])
    if (columns.length === 0 || typeof input.visitor?.['id'] !== 'string') {
      return {} as FormOptionSets
    }
    const accounts = yield* (yield* AuthRepository).listAccountChoices(MAX_ACCOUNT_CHOICES)
    return accountChoiceSets(
      columns,
      accounts.map((account) => ({ value: account.id, label: account.label }))
    )
  })

/**
 * Resolve every table-backed field of `input.form` into its choices, keyed by
 * the field's submit identifier. A form whose choices are all written in the
 * config gets an empty map and runs no query.
 */
export const resolveFormOptionSources = (
  input: ResolveFormOptionSourcesInput
): Effect.Effect<
  FormOptionSets,
  DataSourceDatabaseError | AuthDatabaseError,
  DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const plans = collectFormOptionSources(input.form, input.app.tables ?? [])
    const entries = yield* Effect.forEach(plans, (plan) => readPlan(input.app, plan, input.visitor))
    const accounts = yield* readAccountChoices(input)
    return { ...(Object.fromEntries(entries) as FormOptionSets), ...accounts } as FormOptionSets
  }).pipe(
    Effect.withSpan('forms.resolve-form-option-sources', {
      attributes: { form: input.form.name },
    })
  )
