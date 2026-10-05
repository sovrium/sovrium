/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A hosted form's submitted link must name a row the form offers.
 *
 * A form reads its relationship choices with its OWN authority, narrowed by the
 * field's option source (`optionsSource.filter`, or every row of the related
 * table when the field names no source), and publishes them to anyone who may
 * open it. That offered set is the form's read scope, so it is what judges a
 * submitted link: the submission endpoint accepts any posted id, and a scope
 * that is only drawn in the page is not enforced. A value naming a row outside
 * the set — withheld by the filter, soft-deleted, or missing altogether — is
 * refused with the answer a row that does not exist gets, before anything is
 * written.
 *
 * The set is the one the filter selects at submission, its `$currentUser`
 * references resolved for the submitter exactly as the render resolves them; a
 * reference that cannot be resolved offers nothing, as it does on the page. The
 * display `limit` and `sort` do not narrow what may be submitted. One read per
 * relationship field: the submitted keys, intersected with the filter, read
 * through the SAME gated read the choice list uses (`readAdmittedSourceRows`)
 * — so the related table's row-level read rule for the submitter, signed in or
 * not, withholds a row from the submission exactly as from the list, and a row
 * it hides is answered as a row that does not exist.
 *
 * A config-hidden relationship field draws no list, but its hidden input is
 * posted like any other value, so it is judged by the rows it would offer — its
 * `optionsSource`, else the related table's live rows. The server cannot
 * re-derive a `$query` or `$parent` prefill at submission, so this bounds the
 * value to the form's scope rather than to the one row the page carried.
 */

import { Effect } from 'effect'
import {
  collectSubmittableSources,
  sourceValueField,
  type FormOptionSourcePlan,
} from '@/domain/models/app/forms/form-option-source-service'
import {
  readAdmittedSourceRows,
  resolveSourceFilter,
  type FormOptionVisitor,
} from './resolve-form-option-sources'
import type {
  DataSourceDatabaseError,
  DataSourceRepository,
} from '@/application/ports/repositories/tables/data-source-repository'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/** The keys a submitted link or account value names; blanks name nothing. */
export const submittedKeysOf = (value: unknown): readonly string[] =>
  (Array.isArray(value) ? value : [value])
    .filter((key): key is string | number => typeof key === 'string' || typeof key === 'number')
    .map(String)
    .filter((key) => key !== '')

/** The plans of `form` whose field is bound to a `relationship` column. */
const relationshipPlans = (app: App, form: Form): readonly FormOptionSourcePlan[] => {
  const target = app.tables?.find((table) => table.name === form.submitTo.table)
  const isRelationship = (column: string): boolean =>
    target?.fields.some((field) => field.name === column && field.type === 'relationship') ?? false
  return collectSubmittableSources(form, app.tables ?? []).filter((plan) =>
    isRelationship(plan.field)
  )
}

/** Whether every key `plan` names in `mapped` is among the rows its source offers. */
const offersEveryKey = (
  app: App,
  plan: FormOptionSourcePlan,
  keys: readonly string[],
  visitor: FormOptionVisitor | undefined
): Effect.Effect<boolean, DataSourceDatabaseError, DataSourceRepository> =>
  Effect.gen(function* () {
    const source = resolveSourceFilter(plan.source, visitor)
    if (source === undefined) return false
    const valueField = sourceValueField(source)
    const query = {
      table: source.table,
      options: {
        fields: [valueField],
        filter: [...(source.filter ?? []), { field: valueField, operator: 'in', value: [...keys] }],
        pageSize: keys.length,
        liveOnly: true,
      },
    } as const
    const rows = yield* readAdmittedSourceRows(app, query, visitor)
    const offered = new Set(rows.map((row) => String(row[valueField])))
    return keys.every((key) => offered.has(key))
  })

/**
 * The first relationship field whose submitted value names a row the form does
 * not offer, or `undefined` when every link names an offered row. Reads
 * nothing for a form with no relationship field, or a submission that leaves
 * them empty.
 */
export const findUnofferedLinkField = (input: {
  readonly app: App
  readonly form: Form
  readonly mapped: Readonly<Record<string, unknown>>
  readonly visitor: FormOptionVisitor | undefined
}): Effect.Effect<string | undefined, DataSourceDatabaseError, DataSourceRepository> =>
  Effect.gen(function* () {
    const { app, form, mapped, visitor } = input
    if (form.submitTo.table === undefined) return undefined
    const named = relationshipPlans(app, form)
      .map((plan) => ({ plan, keys: submittedKeysOf(mapped[plan.field]) }))
      .filter((entry) => entry.keys.length > 0)
    const verdicts = yield* Effect.forEach(named, ({ plan, keys }) =>
      offersEveryKey(app, plan, keys, visitor).pipe(Effect.map((offered) => ({ plan, offered })))
    )
    return verdicts.find((verdict) => !verdict.offered)?.plan.field
  }).pipe(Effect.withSpan('forms.find-unoffered-link-field'))
