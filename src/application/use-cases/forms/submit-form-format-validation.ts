/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Data, Effect } from 'effect'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

export class FormFieldFormatError extends Data.TaggedError('FormFieldFormatError')<{
  readonly fieldName: string
  readonly message: string
}> {}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const isInvalidEmailField = (
  field: Readonly<Form['fields'][number]>,
  body: Readonly<Record<string, unknown>>,
  emailColumns: ReadonlySet<string>
): boolean => {
  if (field.kind !== 'table-field') return false
  if (!emailColumns.has(field.column)) return false
  const value = body[field.column]
  if (value === undefined || value === null || value === '') return false
  return typeof value !== 'string' || !EMAIL_REGEX.test(value)
}

export const validateFieldFormats = (
  app: Readonly<App>,
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): Effect.Effect<void, FormFieldFormatError, never> => {
  if (form.submitTo.table === undefined) return Effect.void
  const table = app.tables?.find((t) => t.name === form.submitTo.table)
  if (!table) return Effect.void
  const emailColumns = new Set<string>(
    table.fields.filter((f) => f.type === 'email').map((f) => f.name)
  )
  if (emailColumns.size === 0) return Effect.void
  const invalid = form.fields.find((field) => isInvalidEmailField(field, body, emailColumns))
  if (invalid && invalid.kind === 'table-field') {
    return Effect.fail(
      new FormFieldFormatError({
        fieldName: invalid.column,
        message: `${invalid.column} must be a valid email address`,
      })
    )
  }
  return Effect.void
}
