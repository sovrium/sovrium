/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The answer columns a grid derives from a form (`columnsFrom: { form }`).
 *
 * One column per value-carrying field, in declaration order. A section is a
 * heading and carries no answer, so it yields no column. Each column reads the
 * row's `body.<field>` — the submitted answers sit under `body` on a submission
 * row — is headed by the field's label (its name when it has none), and is not
 * sortable, filterable or editable: the list sorts and searches its envelope,
 * never the answers, and a submission is not edited from an inbox.
 *
 * Each column also carries the FIELD TYPE its answer has, so the grid draws it
 * with that type's cell (a checkbox as a mark, a date as a date). It is a
 * server-resolved property of the derived column, never an authorable key.
 *
 * Pure: the caller supplies the tables (for a table-bound field's column type)
 * and the label translation.
 */

/** The structural slice of a form field this derivation reads. */
export interface FormAnswerFieldShape {
  readonly kind: string
  readonly name?: string
  readonly column?: string
  readonly label?: string
  readonly inputType?: string
  readonly maxFiles?: number
  readonly format?: string
}

/** The structural slice of a form. */
export interface FormAnswerFormShape {
  readonly fields: ReadonlyArray<FormAnswerFieldShape>
  readonly submitTo?: { readonly table?: string }
}

/** The structural slice of a table: its name and its fields' types. */
export interface FormAnswerTableShape {
  readonly name: string
  readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
}

/** One derived answer column, ready to stand beside authored columns. */
export interface FormAnswerColumn {
  readonly field: string
  readonly label: string
  readonly sortable: false
  readonly filterable: false
  readonly editable: false
  readonly _fieldType?: string
}

/** The grid field type a standalone input's answer has. */
const STANDALONE_FIELD_TYPES: Readonly<Record<string, string>> = {
  'short-text': 'single-line-text',
  'long-text': 'long-text',
  email: 'email',
  url: 'url',
  phone: 'phone-number',
  number: 'number',
  date: 'date',
  datetime: 'datetime',
  select: 'single-select',
  'multi-select': 'multi-select',
  checkbox: 'checkbox',
  radio: 'single-select',
  rating: 'rating',
}

/** A standalone field's answer type; an attachment is one file or several, as the form says. */
const standaloneType = (field: FormAnswerFieldShape): string | undefined => {
  if (field.inputType === 'attachment') {
    return (field.maxFiles ?? 1) > 1 ? 'multiple-attachments' : 'single-attachment'
  }
  return field.inputType === undefined ? undefined : STANDALONE_FIELD_TYPES[field.inputType]
}

/** A calculation's answer is a number unless it is formatted as text. */
const calculationType = (field: FormAnswerFieldShape): string | undefined =>
  field.format === 'text' ? undefined : 'number'

/** A field's answer: the name it is submitted under, and its grid field type. */
interface Answer {
  readonly name: string
  readonly type: string | undefined
}

/** A field named by its own `name` (standalone, calculation, signature). */
const named = (field: FormAnswerFieldShape, type: string | undefined): Answer | undefined =>
  field.name === undefined ? undefined : { name: field.name, type }

/** The submitted name and the answer type of one field, or nothing for a section. */
const answerOf = (
  field: FormAnswerFieldShape,
  boundTable: FormAnswerTableShape | undefined
): Answer | undefined => {
  switch (field.kind) {
    case 'table-field': {
      const { column } = field
      if (column === undefined) return undefined
      return { name: column, type: boundTable?.fields.find((f) => f.name === column)?.type }
    }
    case 'standalone':
      return named(field, standaloneType(field))
    case 'calculation':
      return named(field, calculationType(field))
    case 'signature':
      return named(field, 'signature')
    default:
      return undefined
  }
}

/**
 * The answer columns of `form`, in declaration order.
 *
 * @param translate - resolves a field label (`$t:` keys) in the page's language
 */
export const formAnswerColumns = (
  form: FormAnswerFormShape,
  tables: ReadonlyArray<FormAnswerTableShape>,
  translate: (text: string) => string
): readonly FormAnswerColumn[] => {
  const boundTable = tables.find((table) => table.name === form.submitTo?.table)
  return form.fields.flatMap((field) => {
    const answer = answerOf(field, boundTable)
    if (answer === undefined) return []
    const column: FormAnswerColumn = {
      field: `body.${answer.name}`,
      label: field.label === undefined ? answer.name : translate(field.label),
      sortable: false,
      filterable: false,
      editable: false,
      ...(answer.type === undefined ? {} : { _fieldType: answer.type }),
    }
    return [column]
  })
}
