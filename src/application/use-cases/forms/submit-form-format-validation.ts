/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Server-side format validation for table-bound columns at form-submission time.
 *
 * Browsers validate `<input type="email">` client-side, but the API accepted any
 * payload and wrote garbage to the DB. This module now genuinely shares its rule
 * with the table-record CRUD path via {@link findColumnFormatViolations} in
 * `domain/validators/column-formats.ts`.
 *
 * It previously only LOOKED shared. This file validated `email` alone while
 * asserting in its own docstring that `url` "is enforced by the existing
 * validateFieldFormats in field-rules.ts" — which validated `url` alone and
 * never `email`. The two rule sets were disjoint, so a form submission carrying
 * a malformed URL returned 201 and persisted the value (verified by execution).
 *
 * Extracted from `submit-form.ts` to keep that file under the per-file
 * `max-lines` cap as the form-submission validation surface grew with
 * [internal ref] (FK) + [internal ref] (format).
 */

import { Data, Effect } from 'effect'
import { findColumnFormatViolations } from '@/domain/models/app/tables/column-formats-validation'
import { findTableByName } from '@/domain/models/app/tables/table-lookup-service'
import { engineMessageForReader, fieldLabelForReader } from './submit-form-messages'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { FormatConstrainedFieldType } from '@/domain/models/app/tables/column-formats-validation'

/**
 * Form field failed server-side format validation (e.g. an email-typed column
 * received a non-email string). Surfaces as 400 in the route layer with the
 * same `fieldErrors` envelope used for required-field rejections.
 */
export class FormFieldFormatError extends Data.TaggedError('FormFieldFormatError')<{
  readonly fieldName: string
  readonly message: string
}> {}

/**
 * The catalog sentence for each format violation, keyed by column type.
 *
 * Deliberately NOT the records path's `Invalid email format for field 'email'`.
 * A public form is filled in by a stranger, so the message reads as UX copy in
 * the language the form was served in, naming the field by its label, rather
 * than as an API diagnostic naming a column.
 */
const FORMAT_MESSAGE_KEYS: Readonly<Record<FormatConstrainedFieldType, string>> = {
  email: 'form.invalidEmailNamed',
  url: 'form.invalidUrlNamed',
}

/**
 * Resolve the table-column declarations this form binds, in FORM-DECLARATION
 * order.
 *
 * Order is load-bearing: only the FIRST violation is reported, and the previous
 * implementation scanned `form.fields[]`. Feeding the shared rule in table order
 * instead would change which offender a multi-error submission names.
 *
 * Restricting to bound columns is also deliberate — an `email` column the form
 * never exposes is not the submitter's to fix.
 */
const boundColumnDeclarations = (
  form: Readonly<Form>,
  table: Readonly<{ readonly fields: readonly { readonly name: string; readonly type: string }[] }>
): readonly { readonly name: string; readonly type: string }[] =>
  form.fields.flatMap((field) =>
    field.kind === 'table-field'
      ? (table.fields.filter((column) => column.name === field.column) ?? [])
      : []
  )

/**
 * Server-side format validation for table-bound columns (`email`, `url`).
 *
 * Runs AFTER hidden-field stripping so a hidden column never blocks submission.
 * Runs BEFORE `applyMapping` so the field name in the error matches the bound
 * column the submitter sees in the form UI.
 */
export const validateFieldFormats = (
  app: Readonly<App>,
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>,
  lang?: string
): Effect.Effect<void, FormFieldFormatError, never> => {
  if (form.submitTo.table === undefined) return Effect.void
  const table = findTableByName(app.tables, form.submitTo.table)
  if (!table) return Effect.void

  const violations = findColumnFormatViolations(boundColumnDeclarations(form, table), body)
  const first = violations[0]
  if (!first) return Effect.void

  const reader = { app, lang }
  return Effect.fail(
    new FormFieldFormatError({
      fieldName: first.field,
      message: engineMessageForReader(
        reader,
        FORMAT_MESSAGE_KEYS[first.type],
        fieldLabelForReader(reader, form, first.field)
      ),
    })
  ).pipe(Effect.withSpan('forms.validate-field-formats'))
}
