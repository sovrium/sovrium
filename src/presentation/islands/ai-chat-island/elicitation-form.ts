/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type {
  ChatElicitation,
  ChatElicitationAnswer,
  ChatElicitationField,
  QuestionLabels,
} from './types'
import type { Answer, Item } from '../parts/questionnaire-parts'

/**
 * A question the agent asked (`elicit`) as the questionnaire's screens, and
 * the screens' answers back as the answer the turn reads: one screen per field
 * of the flat form, in its order — a choice per `enum` value, Yes and No for a
 * boolean, a box typed by the field's `format` (a date, an email) or a number
 * box for a number.
 */

/** The input type of a typed string field's box, by its `format`. */
const INPUT_TYPES: Readonly<Record<string, string>> = {
  date: 'date',
  'date-time': 'datetime-local',
  email: 'email',
  uri: 'url',
}

/** The form's fields, in its order. */
const fieldsOf = (elicitation: ChatElicitation) =>
  Object.entries(elicitation.requestedSchema.properties)

/** One field of the form as one questionnaire screen. */
const toItem = (
  name: string,
  field: ChatElicitationField,
  input: { readonly required: boolean; readonly labels: QuestionLabels }
): Item => {
  const base = {
    name,
    prompt: field.title,
    required: input.required,
    ...(field.description !== undefined && { description: field.description }),
  }
  if (field.type === 'boolean') {
    const choices = [
      { value: 'true', label: input.labels.yes },
      { value: 'false', label: input.labels.no },
    ]
    return { ...base, choices }
  }
  if (field.enum !== undefined) {
    return { ...base, choices: field.enum.map((value) => ({ value, label: value })) }
  }
  const type = field.type === 'string' ? (INPUT_TYPES[field.format ?? ''] ?? 'text') : 'number'
  return { ...base, input: { label: field.title, type } }
}

/** The question's screens. */
export const toItems = (elicitation: ChatElicitation, labels: QuestionLabels): readonly Item[] => {
  const required = new Set(elicitation.requestedSchema.required ?? [])
  return fieldsOf(elicitation).map(([name, field]) =>
    toItem(name, field, { required: required.has(name), labels })
  )
}

/** One screen's answer as the value its field holds; `undefined` for an empty one. */
const toValue = (
  field: ChatElicitationField,
  answer: Answer
): string | number | boolean | undefined => {
  if (typeof answer !== 'string' || answer === '') return undefined
  if (field.type === 'boolean') return answer === 'true'
  return field.type === 'string' ? answer : Number(answer)
}

/** The screens' answers as the answer the turn reads: the filled fields only. */
export const toContent = (
  elicitation: ChatElicitation,
  answers: Readonly<Record<string, Answer>>
): Readonly<Record<string, string | number | boolean>> =>
  Object.fromEntries(
    fieldsOf(elicitation).flatMap(([name, field]) => {
      const value = toValue(field, answers[name])
      return value === undefined ? [] : [[name, value]]
    })
  )

/** The values of an answer, in the question's order, as the answered line reads them. */
export const answerSummary = (
  elicitation: ChatElicitation,
  answer: ChatElicitationAnswer,
  labels: Pick<QuestionLabels, 'yes' | 'no'>
): readonly string[] =>
  answer.action !== 'accept'
    ? []
    : fieldsOf(elicitation).flatMap(([name]) => {
        const value = answer.content[name]
        if (value === undefined) return []
        if (typeof value === 'boolean') return [value ? labels.yes : labels.no]
        return [String(value)]
      })
