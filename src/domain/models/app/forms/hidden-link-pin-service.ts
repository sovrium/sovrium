/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which hidden form fields are pinned, and to what.
 *
 * A form field hidden in the form's own declaration (`hidden: true`) and bound
 * to a `relationship` or a `user` column carries a value the visitor never
 * chose: the server rendered it, from the form's own starting value or from a
 * page that embeds the form with an `inlinePrefill`. Those are the values
 * permission rules are keyed on — whose record, under which row — so the
 * submission accepts only a value the server itself would have rendered there
 * for this submitter, re-derived at submission.
 *
 * This module is the form's pure half: which fields are pinned, the form's own
 * starting value for each, and what any prefill value could put into a link.
 * The pages that embed the form are read by `formEmbeddingPrefills` in the
 * pages model (a page may depend on a form, not the reverse). Resolving a source for one
 * submitter — who they are, which pages they may open, which records those
 * pages read for them — needs the database and lives in the application layer.
 *
 * One exception unpins a field outright: a form whose own starting value reads
 * the query string (`$query.<name>`). The visitor writes the URL, so the value
 * is theirs to choose, and the field stays bounded by the rows the form offers,
 * nothing more.
 */

import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/** What one prefill value could put into a hidden link or account. */
export type PinSource =
  /** Itself: a literal id, or several. */
  | { readonly kind: 'literal'; readonly values: readonly string[] }
  /** A property of the signed-in submitter (`$user.<prop>`). */
  | { readonly kind: 'user'; readonly prop: string }
  /** A column of the record the embedding page reads (`$parent.<col>` / `$record.<col>`). */
  | { readonly kind: 'record'; readonly column: string }
  /** The query string, which the visitor writes (`$query.<name>`). */
  | { readonly kind: 'query' }
  /** Nothing a link could hold: `$now`, a deeper path, an unknown token, a boolean. */
  | { readonly kind: 'none' }

const RECORD_PREFIXES = ['$parent.', '$record.'] as const

const classifyToken = (value: string): PinSource => {
  if (value.startsWith('$query.')) return { kind: 'query' }
  if (value.startsWith('$user.')) {
    const prop = value.slice('$user.'.length)
    return prop === '' || prop.includes('.') ? { kind: 'none' } : { kind: 'user', prop }
  }
  const prefix = RECORD_PREFIXES.find((candidate) => value.startsWith(candidate))
  if (prefix !== undefined) {
    const column = value.slice(prefix.length)
    return column === '' || column.includes('.') ? { kind: 'none' } : { kind: 'record', column }
  }
  return value.startsWith('$') ? { kind: 'none' } : { kind: 'literal', values: [value] }
}

/** Classify one prefill or default value by what it could put into a link. */
export const classifyPinSource = (value: unknown): PinSource => {
  if (typeof value === 'string') return classifyToken(value)
  if (typeof value === 'number') return { kind: 'literal', values: [String(value)] }
  if (Array.isArray(value)) {
    const values = value.filter(
      (item): item is string | number => typeof item === 'string' || typeof item === 'number'
    )
    return { kind: 'literal', values: values.map(String) }
  }
  return { kind: 'none' }
}

/** One pinned field: its column, and the form's own starting value for it. */
export interface PinnedField {
  /** The bound column — the key the submission carries the value under. */
  readonly column: string
  /** The form's own starting value (its `prefill`, else the field's `defaultValue`). */
  readonly formSource: PinSource
}

type FieldShape = {
  readonly kind?: unknown
  readonly column?: unknown
  readonly hidden?: unknown
  readonly defaultValue?: unknown
}

/** The columns of `form` hidden in its own declaration and bound to a link or an account. */
const pinnableColumns = (app: App, form: Form): readonly string[] => {
  const target = app.tables?.find((table) => table.name === form.submitTo.table)
  if (target === undefined) return []
  const linkTyped = new Set(
    target.fields
      .filter((field) => field.type === 'relationship' || field.type === 'user')
      .map((field) => field.name)
  )
  return (form.fields as readonly FieldShape[]).flatMap((field) =>
    field.kind === 'table-field' &&
    field.hidden === true &&
    typeof field.column === 'string' &&
    linkTyped.has(field.column)
      ? [field.column]
      : []
  )
}

/** The form's own starting value for `column`: its `prefill` entry, else the field's default. */
const formStartingValue = (form: Form, column: string): unknown => {
  const { prefill } = form as { readonly prefill?: Readonly<Record<string, unknown>> }
  if (prefill !== undefined && column in prefill) return prefill[column]
  const field = (form.fields as readonly FieldShape[]).find(
    (candidate) => candidate.kind === 'table-field' && candidate.column === column
  )
  return field?.defaultValue
}

/**
 * The pinned fields of `form`, each with the form's own starting value. A
 * field whose starting value reads the query string is not pinned and is left
 * out. The pages that embed the form add their own sources
 * (`formEmbeddingPrefills` in the pages model).
 */
export const pinnedFieldsOf = (app: App, form: Form): readonly PinnedField[] =>
  pinnableColumns(app, form).flatMap((column) => {
    const formSource = classifyPinSource(formStartingValue(form, column))
    return formSource.kind === 'query' ? [] : [{ column, formSource }]
  })
