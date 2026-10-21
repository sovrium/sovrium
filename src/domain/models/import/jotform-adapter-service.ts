/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Jotform adapter: a form (`GET /form/{id}`), its questions, its
 * properties and its submission pages into a `CanonicalForm`, pinned under
 * `[internal ref]`.
 *
 * - Every answer is wrapped in Jotform's envelope (`responseCode`, `content`,
 *   `limit-left`); the form's `content` is an object, though the docs show a
 *   one-item list, so both are read.
 * - The questions are an object keyed by question id, in `order`; a page
 *   break starts the next page, named `page-<n>` as the conditions name it.
 * - A choice question's options are one `|`-separated string.
 * - A hidden field (`control_hidden`) becomes a hidden field of the form.
 *
 * ## Conditions are reported, not converted
 *
 * Conditions are form properties whose terms and actions are JSON held in
 * strings. Each one is reported as a TODO quoting it, never turned into a
 * visibility rule, a step jump or a calculation: they are read and kept, and
 * recreating them is left to whoever knows the form.
 *
 * A question an "Update/Calculate Field" condition fills is not something the
 * respondent answered: it becomes a variable named by the question's Jotform
 * `name`, so the values Jotform computed are kept in a column of that name. A
 * widget (`control_widget`) exposes none of its settings: its answers are
 * kept as text, and it is reported as a TODO.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { objectsOf, plainText, readFormSnapshot, textOf } from './form-snapshot-service'
import { adaptJotformSubmissions, jotformContent } from './jotform-responses-service'
import type { CanonicalForm } from './canonical-form'

type Json = Readonly<Record<string, unknown>>
type Question = CanonicalForm['questions'][number]
type Rule = CanonicalForm['rules'][number]

/** The snapshot path of the questions a fetch wrote. */
export const JOTFORM_QUESTIONS_PATH = 'raw/questions.json'

/** The snapshot path of the form properties (where the conditions live) a fetch wrote. */
export const JOTFORM_PROPERTIES_PATH = 'raw/properties.json'

const CHOICE_TYPES: ReadonlySet<string> = new Set([
  'control_dropdown',
  'control_radio',
  'control_checkbox',
])

const NUMERIC_TYPES: ReadonlySet<string> = new Set(['control_number', 'control_spinner'])

const PAGE_BREAK = 'control_pagebreak'
const HIDDEN = 'control_hidden'
const WIDGET = 'control_widget'

const STRUCTURAL: ReadonlySet<string> = new Set([
  'control_head',
  'control_text',
  'control_button',
  'control_collapse',
  'control_image',
  'control_captcha',
  PAGE_BREAK,
])

/** An object document: the envelope's `content`, or the first item of a one-item list. */
const documentOf = (json: unknown): Json => {
  const content = jotformContent(json)
  if (Array.isArray(content)) return objectsOf(content)[0] ?? {}
  return isRecord(content) ? content : {}
}

/** A string holding JSON, parsed; anything else as it is. */
const parsedText = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    // Not JSON: the text is quoted as it is.
    return value
  }
}

/** One condition, with its terms and actions parsed from their JSON strings. */
export interface JotformCondition {
  readonly type: string
  readonly link: string
  readonly terms: unknown
  readonly actions: readonly Json[]
  readonly raw: Json
}

/** The conditions of a properties document, in their order. */
export const jotformConditions = (properties: unknown): readonly JotformCondition[] =>
  objectsOf(documentOf(properties)['conditions'])
    .toSorted((a, b) => Number(a['index'] ?? 0) - Number(b['index'] ?? 0))
    .map((condition) => {
      const terms = parsedText(condition['terms'])
      const parsed = parsedText(condition['action'])
      const actions = objectsOf(Array.isArray(parsed) ? parsed : [parsed])
      return {
        type: String(condition['type'] ?? ''),
        link: String(condition['link'] ?? ''),
        terms,
        actions,
        raw: { type: condition['type'], link: condition['link'], terms, action: actions },
      }
    })

/** The questions in their order. */
const orderedQuestions = (questions: unknown): readonly Json[] =>
  Object.values(isRecord(jotformContent(questions)) ? (jotformContent(questions) as Json) : {})
    .filter(isRecord)
    .toSorted((a, b) => Number(a['order'] ?? 0) - Number(b['order'] ?? 0))

const idOf = (question: Json): string => String(question['qid'])

/** Each question with the page it sits on: `page-1` until the first page break. */
const paged = (questions: readonly Json[]) =>
  questions.reduce<{ readonly page: number; readonly out: readonly (readonly [Json, string])[] }>(
    (acc, question) =>
      question['type'] === PAGE_BREAK
        ? { page: acc.page + 1, out: acc.out }
        : { page: acc.page, out: [...acc.out, [question, `page-${String(acc.page)}`] as const] },
    { page: 1, out: [] }
  ).out

const questionOf = (question: Json, page: string): Question => {
  const type = String(question['type'] ?? 'unknown')
  const choices = CHOICE_TYPES.has(type)
    ? String(question['options'] ?? '')
        .split('|')
        .map((label) => label.trim())
        .filter((label) => label !== '')
        .map((label) => ({ label }))
    : []
  const title = plainText(textOf(question['text']) ?? '')
  return {
    sourceId: idOf(question),
    ...(textOf(question['name']) === undefined ? {} : { ref: String(question['name']) }),
    title: title === '' ? String(question['name'] ?? idOf(question)) : title,
    sourceType: type,
    required: question['required'] === 'Yes',
    ...(choices.length === 0 ? {} : { choices }),
    ...(type === 'control_checkbox' ? { allowMultiple: true } : {}),
    page,
  }
}

/** The ids of the questions an "Update/Calculate Field" condition fills. */
const calculatedIds = (conditions: readonly JotformCondition[]): ReadonlySet<string> =>
  new Set(
    conditions
      .filter((condition) => condition.type === 'calculation')
      .flatMap((condition) => condition.actions.map((action) => String(action['resultField'])))
  )

/** The name a computed question's values are kept under: its Jotform name, else its label. */
const variableNameOf = (question: Json): string =>
  textOf(question['name'])?.trim() || plainText(textOf(question['text']) ?? '') || idOf(question)

const isNumeric = (question: Json): boolean =>
  NUMERIC_TYPES.has(String(question['type'])) || question['validation'] === 'Numeric'

/** Why each kind of condition is reported, and how to recreate it. */
const CONDITION_REASONS: Readonly<Record<string, string>> = {
  field:
    'Jotform conditions are reported, not converted: this one shows or hides a field. Recreate it as a visibleWhen on that field.',
  page: 'Jotform conditions are reported, not converted: this one skips to a page. Recreate it as a goToWhen on the step.',
  calculation:
    'Jotform conditions are reported, not converted: this one computes a field. The values Jotform computed are kept in its column; recreate the formula as a calculation field.',
}

const OTHER_REASON =
  'Jotform conditions are reported, not converted: this one (an email, a link or a message) has no Sovrium form equivalent.'

const WIDGET_REASON =
  'A Jotform widget is reported: the API exposes none of its settings, so its answers are kept as text. Recreate the field by hand.'

/** Every condition and widget, as reported rules. */
const rulesOf = (
  conditions: readonly JotformCondition[],
  questions: readonly Json[],
  variableOf: (id: string) => string | undefined
): readonly Rule[] => [
  ...conditions.map((condition) => {
    const first = condition.actions[0] ?? {}
    const target =
      condition.type === 'calculation'
        ? variableOf(String(first['resultField']))
        : textOf(first['field'])
    return {
      kind: 'other' as const,
      ...(target === undefined ? {} : { target }),
      raw: condition.raw,
      reason: CONDITION_REASONS[condition.type] ?? OTHER_REASON,
    }
  }),
  ...questions
    .filter((question) => question['type'] === WIDGET)
    .map((question) => ({
      kind: 'other' as const,
      target: idOf(question),
      raw: question,
      reason: WIDGET_REASON,
    })),
]

/** What the respondent saw after submitting: the redirect, or the thank-you text. */
const thankYouOf = (properties: Json): CanonicalForm['thankYou'] => {
  const url = textOf(properties['thankurl'])?.trim()
  if (properties['activeRedirect'] === 'thankurl' && url !== undefined && url !== '') {
    return { redirectUrl: url }
  }
  const message = plainText(textOf(properties['thanktext']) ?? '')
  return message === '' ? undefined : { message }
}

/** Read a Jotform snapshot into a `CanonicalForm`. */
export const adaptJotformSnapshot = (files: ReadonlyMap<string, unknown>): CanonicalForm => {
  const snapshot = readFormSnapshot(files)
  const form = documentOf(snapshot.definition)
  const properties = documentOf(files.get(JOTFORM_PROPERTIES_PATH))
  const conditions = jotformConditions(files.get(JOTFORM_PROPERTIES_PATH))
  const all = orderedQuestions(files.get(JOTFORM_QUESTIONS_PATH))
  const computed = calculatedIds(conditions)
  const variables = all.filter((question) => computed.has(idOf(question)))
  const hidden = all.filter((question) => question['type'] === HIDDEN)
  const placed = paged(all).filter(
    ([question]) => !computed.has(idOf(question)) && question['type'] !== HIDDEN
  )
  const questions = placed.map(([question, page]) => questionOf(question, page))
  const variableNames = new Map(variables.map((one) => [idOf(one), variableNameOf(one)] as const))
  const read = adaptJotformSubmissions(snapshot.pages, {
    questions: new Map(questions.map((one) => [one.sourceId, one] as const)),
    variables: new Map(
      variables.map(
        (one) => [idOf(one), { name: variableNameOf(one), numeric: isNumeric(one) }] as const
      )
    ),
    hidden: new Map(hidden.map((one) => [idOf(one), String(one['name'] ?? idOf(one))] as const)),
    structural: new Set(
      all.filter((one) => STRUCTURAL.has(String(one['type']))).map((one) => idOf(one))
    ),
    assets: snapshot.assets,
  })
  const pageIds = [...new Set(placed.map(([, page]) => page))]
  const thankYou = thankYouOf(properties)
  return {
    tool: 'jotform',
    sourceId: String(form['id'] ?? properties['id'] ?? 'form'),
    title: textOf(form['title'])?.trim() || textOf(properties['title'])?.trim() || 'Jotform form',
    questions: [...questions, ...read.retired],
    pages: pageIds.map((page) => ({
      sourceId: page,
      questions: placed.filter(([, on]) => on === page).map(([question]) => idOf(question)),
    })),
    rules: rulesOf(conditions, all, (id) => variableNames.get(id)),
    hiddenFields: hidden.map((one) => String(one['name'] ?? idOf(one))),
    variables: variables.map((one) => ({
      name: variableNameOf(one),
      kind: isNumeric(one) ? ('number' as const) : ('text' as const),
    })),
    ...(thankYou === undefined ? {} : { thankYou }),
    definitionInferred: false,
    responses: read.responses,
  }
}
