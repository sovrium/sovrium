/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Store every checkbox a form binds as `true` or `false`.
 *
 * A browser leaves an unticked box out of the post and sends a ticked one as
 * `on`; the plain form post also drops empty values on its way in. Left as
 * posted, an unticked box reached the column as nothing and stored NULL, and
 * the text spellings relied on the database's own reading of `on`. Every
 * checkbox column the form binds is therefore given its answer here — a
 * missing one included — before the required check, so a required box (a
 * consent) is judged on the same answer that is stored.
 */

import { toCheckboxAnswer } from '@/domain/models/app/forms/form-checkbox-answer-service'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/**
 * Columns of `submitTo.table` of type `checkbox` that the form binds with a
 * `table-field`. Empty when the form writes no table.
 */
export const boundCheckboxColumns = (
  app: Readonly<App>,
  form: Readonly<Form>
): ReadonlySet<string> => {
  const table = app.tables?.find((candidate) => candidate.name === form.submitTo.table)
  if (table === undefined) return new Set()
  const checkboxColumns = new Set(
    (table.fields ?? []).filter((field) => field.type === 'checkbox').map((field) => field.name)
  )
  return new Set(
    form.fields.flatMap((field) =>
      field.kind === 'table-field' && checkboxColumns.has(field.column) ? [field.column] : []
    )
  )
}

/**
 * The body with each named checkbox column holding its stored answer — a box
 * left out reads `false`. Every other entry passes through untouched.
 */
export const coerceCheckboxAnswers = (
  body: Readonly<Record<string, unknown>>,
  columns: ReadonlySet<string>
): Readonly<Record<string, unknown>> => {
  if (columns.size === 0) return { ...body }
  return {
    ...body,
    ...Object.fromEntries([...columns].map((column) => [column, toCheckboxAnswer(body[column])])),
  }
}
