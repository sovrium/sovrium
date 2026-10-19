/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A submission's answers as its form asks them: each answer named by its
 * question's label, in the form's own sections and order.
 *
 * A submitted body is keyed by the questions' NAMES (`project_type`), which
 * are the form's identifiers, not what a reader was asked. This reads it back
 * through the form: an answer is keyed by its question's label, the answers of
 * a `fieldGroups` section sit together under that section's label, and an
 * answer no section lists sits at the top, before the sections. A section
 * holding no answer is left out.
 *
 * Every value is the text a reader reads: a choice by its option's label, a
 * list joined, a file by its name. Nothing here reads a value the body does
 * not hold, and nothing the form does not ask for is shown.
 */

/** An answer as text, or a section of them keyed by its question's label. */
export type SubmissionAnswers = Readonly<Record<string, string | Readonly<Record<string, string>>>>

/** The parts of a form field this reading needs. */
interface AnswerField {
  readonly kind: string
  readonly name?: string
  readonly column?: string
  readonly label?: string
  readonly options?: ReadonlyArray<{ readonly value: unknown; readonly label?: string }>
}

/** The parts of a form this reading needs. */
export interface AnswerForm {
  readonly fields: ReadonlyArray<AnswerField>
  readonly fieldGroups?: ReadonlyArray<{
    readonly label: string
    readonly fields: ReadonlyArray<string>
  }>
}

/** How labels become words: the page language, and a readable name for an unlabelled question. */
export interface AnswerWords {
  readonly translate: (text: string) => string
  readonly readableName: (name: string) => string
}

/** The key a field's answer is stored under; a section heading or a note stores none. */
const answerKey = (field: AnswerField): string | undefined =>
  field.kind === 'table-field' ? field.column : field.kind === 'section' ? undefined : field.name

/** A stored file (an upload's `{ name, url }`) or any other object, as text. */
const objectText = (value: object): string => {
  const file = value as { readonly name?: unknown; readonly url?: unknown }
  const named = file.name ?? file.url
  return typeof named === 'string' ? named : JSON.stringify(value)
}

/**
 * A stored scalar as text: a choice by its option's label. Only the form's own
 * words are translated; what the person wrote is shown as written.
 */
const scalarText = (value: unknown, field: AnswerField, words: AnswerWords): string => {
  const option = field.options?.find((candidate) => candidate.value === value)
  if (option?.label !== undefined) return words.translate(option.label)
  return value === null || value === undefined ? '' : String(value)
}

/** One stored value as the text a reader reads. */
const answerText = (value: unknown, field: AnswerField, words: AnswerWords): string => {
  if (Array.isArray(value)) return value.map((item) => answerText(item, field, words)).join(', ')
  if (value !== null && typeof value === 'object') return objectText(value)
  return scalarText(value, field, words)
}

/** The answers of `fields` this body holds, keyed by their questions' labels. */
const answersOf = (
  fields: ReadonlyArray<AnswerField>,
  body: Readonly<Record<string, unknown>>,
  words: AnswerWords
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    fields.flatMap((field) => {
      const key = answerKey(field)
      if (key === undefined || !(key in body)) return []
      const label =
        field.label === undefined ? words.readableName(key) : words.translate(field.label)
      return [[label, answerText(body[key], field, words)]] as const
    })
  )

/** The submission's answers, in the form's sections and order. */
export const groupSubmissionAnswers = (
  form: AnswerForm,
  body: Readonly<Record<string, unknown>>,
  words: AnswerWords
): SubmissionAnswers => {
  const groups = form.fieldGroups ?? []
  const grouped = new Set(groups.flatMap((group) => group.fields))
  const byKey = new Map(
    form.fields.flatMap((field) => {
      const key = answerKey(field)
      return key === undefined ? [] : [[key, field] as const]
    })
  )
  const loose = answersOf(
    form.fields.filter((field) => !grouped.has(answerKey(field) ?? '')),
    body,
    words
  )
  const sections = groups.flatMap((group) => {
    const fields = group.fields.flatMap((name) => {
      const field = byKey.get(name)
      return field === undefined ? [] : [field]
    })
    const answers = answersOf(fields, body, words)
    return Object.keys(answers).length === 0
      ? []
      : [[words.translate(group.label), answers] as const]
  })
  return { ...loose, ...Object.fromEntries(sections) }
}
