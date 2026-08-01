/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Data, Effect } from 'effect'
import { findColumnFormatViolations } from '@/domain/validators/column-formats'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { FormatConstrainedFieldType } from '@/domain/validators/column-formats'

export class FormFieldFormatError extends Data.TaggedError('FormFieldFormatError')<{
  readonly fieldName: string
  readonly message: string
}> {}

const FORMAT_MESSAGES: Readonly<Record<FormatConstrainedFieldType, (column: string) => string>> = {
  email: (column) => `${column} must be a valid email address`,
  url: (column) => `${column} must be a valid URL`,
}

const boundColumnDeclarations = (
  form: Readonly<Form>,
  table: Readonly<{ readonly fields: readonly { readonly name: string; readonly type: string }[] }>
): readonly { readonly name: string; readonly type: string }[] =>
  form.fields.flatMap((field) =>
    field.kind === 'table-field'
      ? (table.fields.filter((column) => column.name === field.column) ?? [])
      : []
  )

export const validateFieldFormats = (
  app: Readonly<App>,
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): Effect.Effect<void, FormFieldFormatError, never> => {
  if (form.submitTo.table === undefined) return Effect.void
  const table = app.tables?.find((t) => t.name === form.submitTo.table)
  if (!table) return Effect.void

  const violations = findColumnFormatViolations(boundColumnDeclarations(form, table), body)
  const first = violations[0]
  if (!first) return Effect.void

  return Effect.fail(
    new FormFieldFormatError({
      fieldName: first.field,
      message: FORMAT_MESSAGES[first.type](first.field),
    })
  )
}
