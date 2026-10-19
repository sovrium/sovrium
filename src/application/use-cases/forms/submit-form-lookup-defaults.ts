/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A hidden field's lookup default, found again when the form is submitted.
 *
 * A hidden field is filled by the server, so what it files the record under
 * is the row its lookup finds NOW, for this submitter — read through the same
 * gated read the form's choices use (`readAdmittedSourceRows`), never the
 * value the browser posted back. The form is handed on with that row's id as
 * the field's literal default (`withResolvedLookupDefaults`), so the defaults
 * overlay and the hidden-link check read it like any other default; a lookup
 * that finds nothing files the record under nothing.
 */

import { Effect } from 'effect'
import {
  readAdmittedSourceRows,
  resolveSourceFilter,
  type FormOptionVisitor,
} from '@/application/use-cases/forms/resolve-form-option-sources'
import {
  hiddenLookupFields,
  lookupDefaultSource,
  withResolvedLookupDefaults,
} from '@/domain/models/app/forms/form-lookup-default-service'
import {
  optionSourceQuery,
  rowsToOptions,
} from '@/domain/models/app/forms/form-option-source-service'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/** The id ONE hidden lookup finds for this submitter, or `undefined` when it finds none. */
const findLookupRow = (
  app: App,
  lookup: Parameters<typeof lookupDefaultSource>[0],
  visitor: FormOptionVisitor | undefined
) =>
  Effect.gen(function* () {
    const source = resolveSourceFilter(lookupDefaultSource(lookup), visitor)
    if (source === undefined) return undefined
    const rows = yield* readAdmittedSourceRows(app, optionSourceQuery(source), visitor)
    return rowsToOptions(rows, source)[0]?.value
  })

/**
 * `form` with every hidden lookup default resolved for this submitter. A form
 * with no hidden lookup is returned as it is, and reads nothing.
 */
export const withHiddenLookupDefaults = (
  app: App,
  form: Form,
  visitor: FormOptionVisitor | undefined
) =>
  Effect.gen(function* () {
    const fields = hiddenLookupFields(form)
    if (fields.length === 0) return form
    const found = yield* Effect.forEach(fields, ({ column, lookup }) =>
      findLookupRow(app, lookup, visitor).pipe(
        Effect.map((id) => (id === undefined ? [] : [[column, id] as const]))
      )
    )
    return withResolvedLookupDefaults(form, Object.fromEntries(found.flat()))
  }).pipe(Effect.withSpan('forms.with-hidden-lookup-defaults', { attributes: { form: form.name } }))
