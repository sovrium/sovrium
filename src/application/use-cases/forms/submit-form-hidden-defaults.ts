/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A hidden field with a default keeps only what the server rendered into it.
 *
 * A field declared `hidden: true` with a scalar `defaultValue` is drawn holding
 * its prefill — the form's own, or a page's `inlinePrefill` — and posted back.
 * Before the answers are shaped, every such value is checked against what the
 * server could have rendered there for this submitter, re-derived from the
 * configuration with the hidden-link pin's own sources and read rules
 * (`submit-form-hidden-pins.ts`): the field's default, the form's `prefill`
 * entry, and the `inlinePrefill` of each embedding page whose `access` admits
 * the submitter, `$query` admitting any value. A value outside that set, an
 * empty one or a list is dropped, so the defaults overlay stores the field's
 * default and the submission goes through.
 *
 * Reads nothing for a form with no such field, or a submission whose values
 * are all vouched for by a literal or the query string; otherwise one session
 * lookup and, per value a record source might hold, the hidden-link pin's
 * existence queries.
 */

import { Effect } from 'effect'
import {
  acceptsAnyValue,
  classifyScalarSource,
  defaultPinnedFieldsOf,
  formOwnSourcesOf,
  submittedScalarOf,
} from '@/domain/models/app/forms/hidden-default-pin-service'
import {
  embeddingsOf,
  holdsOnlyRenderedValues,
  loadSubmitter,
  type HiddenPinRequirements,
} from './submit-form-hidden-pins'
import type { FormOptionVisitor } from './resolve-form-option-sources'
import type { TableReadError } from '@/application/ports/repositories/tables/table-repository'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/**
 * `body` less every value a hidden field with a default holds that the server
 * could not have rendered into it for this submitter.
 */
export const withoutUnrenderedHiddenValues = (input: {
  readonly app: App
  readonly form: Form
  readonly body: Readonly<Record<string, unknown>>
  readonly visitor: FormOptionVisitor | undefined
  readonly submitterUserId: string | undefined
}): Effect.Effect<Readonly<Record<string, unknown>>, TableReadError, HiddenPinRequirements> =>
  Effect.gen(function* () {
    const { app, form, body } = input
    const submitted = defaultPinnedFieldsOf(app, form)
      .filter(({ key }) => Object.hasOwn(body, key))
      .map((field) => ({ ...field, value: submittedScalarOf(body[field.key]) }))
    if (submitted.length === 0) return body
    const judged = submitted.filter(
      ({ value, formSources }) => value !== undefined && !acceptsAnyValue(formSources)
    )
    const submitter =
      judged.length === 0
        ? undefined
        : yield* loadSubmitter({
            app,
            table: app.tables?.find((table) => table.name === form.submitTo.table),
            visitor: input.visitor,
            submitterUserId: input.submitterUserId,
          })
    const verdicts = yield* Effect.forEach(submitted, ({ key, value, formSources }) => {
      if (value === undefined) return Effect.succeed({ key, kept: false })
      if (submitter === undefined || acceptsAnyValue(formSources))
        return Effect.succeed({ key, kept: true })
      const pin = {
        column: key,
        formSources,
        embeddings: embeddingsOf(app, form.name, key, classifyScalarSource),
      }
      return holdsOnlyRenderedValues({ app, pin, keys: [value], submitter }).pipe(
        Effect.map((kept) => ({ key, kept }))
      )
    })
    const dropped = new Set(verdicts.filter(({ kept }) => !kept).map(({ key }) => key))
    if (dropped.size === 0) return body
    return Object.fromEntries(Object.entries(body).filter(([key]) => !dropped.has(key)))
  }).pipe(Effect.withSpan('forms.without-unrendered-hidden-values'))

/**
 * Whether hidden field `key` holds only what the form filled into it: a hidden
 * field with a default none of whose sources — its default, the form's
 * `prefill`, the `inlinePrefill` of any page embedding the form — reads the
 * query string, which the visitor writes. Such a field keeps only a value the
 * server rendered, so a value its `options` refuse was never the visitor's.
 */
export const isFilledByTheFormOnly = (app: App, form: Form, key: string): boolean => {
  const own = formOwnSourcesOf(app, form, key)
  if (own === undefined) return false
  const embedded = embeddingsOf(app, form.name, key, classifyScalarSource).map(
    ({ source }) => source
  )
  return !acceptsAnyValue([...own, ...embedded])
}
