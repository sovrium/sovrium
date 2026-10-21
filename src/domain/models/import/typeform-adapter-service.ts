/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Typeform adapter: a form definition (`GET /forms/{id}`) and its response
 * pages (`GET /forms/{id}/responses`) into a `CanonicalForm`, pinned under
 * `[internal ref]`.
 *
 * - **Questions** are `fields[]`; a `group` is a page of its own, its children
 *   its questions, and the questions between two groups another page.
 * - **Logic** is `logic[]`: per field (or for the hidden fields), an ordered
 *   list of actions. A `jump` becomes a jump rule evaluated after that field —
 *   to a field, to the default thank-you screen (`end`) or another one
 *   (`end:<ref>`); an `add`/`subtract`/`multiply`/`divide`/`set` on a variable
 *   becomes a calculation step. A choice is compared by its label, the value a
 *   response holds.
 * - **Responses** are read in `typeform-responses-service.ts`.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { objectsOf, oldestFirst, readFormSnapshot, textOf } from './form-snapshot-service'
import { typeformResponsesOf } from './typeform-responses-service'
import type { CanonicalCondition } from './canonical-flow'
import type { CanonicalForm } from './canonical-form'

type Json = Readonly<Record<string, unknown>>
type Question = CanonicalForm['questions'][number]
type Rule = CanonicalForm['rules'][number]

/** The thank-you screen Typeform shows when no jump picks another. */
const DEFAULT_SCREEN = 'default_tys'

const ARITHMETIC = new Set(['add', 'subtract', 'multiply', 'divide', 'set'])

const propertiesOf = (field: Json): Json =>
  isRecord(field['properties']) ? field['properties'] : {}

/** A key kept only when it holds a value. */
const optional = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> =>
  value === undefined ? {} : ({ [key]: value } as Partial<Record<K, V>>)

/** A choice question's choices, each by its `ref` (what a logic condition names). */
const choicesOf = (choices: unknown) =>
  objectsOf(choices).map((choice) => ({
    ...optional('sourceId', textOf(choice['ref'] ?? choice['id'])),
    label: String(choice['label'] ?? ''),
  }))

const questionOf = (field: Json, page: string | undefined): Question => {
  const { choices, fields: _children, description, ...rest } = propertiesOf(field)
  const choiceList = choicesOf(choices)
  const validations = isRecord(field['validations']) ? field['validations'] : {}
  const multiple = rest['allow_multiple_selection']
  return {
    sourceId: String(field['id'] ?? field['ref']),
    ...optional('ref', textOf(field['ref'])),
    title: String(field['title'] ?? ''),
    ...optional('description', textOf(description)),
    sourceType: String(field['type'] ?? 'unknown'),
    required: validations['required'] === true,
    ...optional('choices', choiceList.length === 0 ? undefined : choiceList),
    ...optional('allowMultiple', typeof multiple === 'boolean' ? multiple : undefined),
    ...optional('properties', Object.keys(rest).length === 0 ? undefined : rest),
    ...optional('page', page),
  }
}

/** The questions and pages: a group is a page, the runs between groups pages too. */
const layoutOf = (fields: readonly Json[]) => {
  const grouped = fields.some((field) => field['type'] === 'group')
  const runs = fields.reduce<
    readonly { readonly page: Json | undefined; readonly fields: readonly Json[] }[]
  >((acc, field) => {
    if (field['type'] === 'group') {
      return [...acc, { page: field, fields: objectsOf(propertiesOf(field)['fields']) }]
    }
    const last = acc.at(-1)
    return last !== undefined && last.page === undefined
      ? [...acc.slice(0, -1), { page: undefined, fields: [...last.fields, field] }]
      : [...acc, { page: undefined, fields: [field] }]
  }, [])
  const pages = runs.map((run, index) => ({
    sourceId:
      run.page === undefined
        ? `page-${String(index + 1)}`
        : String(run.page['id'] ?? run.page['ref']),
    ...(run.page === undefined || textOf(run.page['title']) === undefined
      ? {}
      : { title: String(run.page['title']) }),
    fields: run.fields,
  }))
  const questions = pages.flatMap((page) =>
    page.fields.map((field) => questionOf(field, grouped ? page.sourceId : undefined))
  )
  return {
    questions,
    pages: grouped
      ? pages.map((page) => ({
          sourceId: page.sourceId,
          ...(page.title === undefined ? {} : { title: page.title }),
          questions: page.fields.map((field) => String(field['id'] ?? field['ref'])),
        }))
      : [],
  }
}

interface Context {
  readonly byRef: ReadonlyMap<string, Question>
}

const questionIdOf = (context: Context, ref: string): string =>
  context.byRef.get(ref)?.sourceId ?? ref

/** One side of a comparison: a field, hidden field or variable on the left, a value on the right. */
const leftOf = (context: Context, operand: Json): unknown => {
  const value = String(operand['value'] ?? '')
  if (operand['type'] === 'field') return { question: questionIdOf(context, value) }
  if (operand['type'] === 'hidden') return { hidden: value }
  if (operand['type'] === 'variable') return { variable: value }
  return operand
}

const rightOf = (context: Context, field: Json | undefined, operand: Json | undefined): unknown => {
  if (operand === undefined) return undefined
  if (operand['type'] !== 'choice') return operand['value']
  const ref = String(operand['value'] ?? '')
  const question =
    field?.['type'] === 'field' ? context.byRef.get(String(field['value'])) : undefined
  return question?.choices?.find((choice) => choice.sourceId === ref)?.label ?? ref
}

const conditionOf = (context: Context, condition: Json): CanonicalCondition => {
  const op = String(condition['op'] ?? '')
  const vars = objectsOf(condition['vars'])
  if (op === 'and' || op === 'or') {
    return {
      combinator: op,
      rules: vars.map((sub) => ({ left: conditionOf(context, sub), operator: 'group' })),
    }
  }
  const [left, right] = vars
  return {
    combinator: 'and',
    rules: [
      {
        left: left === undefined ? undefined : leftOf(context, left),
        operator: op,
        ...(right === undefined ? {} : { right: rightOf(context, left, right) }),
      },
    ],
  }
}

const operandOf = (context: Context, value: Json | undefined) => {
  if (value === undefined) return undefined
  if (value['type'] === 'constant' && typeof value['value'] === 'number') {
    return { constant: value['value'] }
  }
  if (value['type'] === 'field') return { question: questionIdOf(context, String(value['value'])) }
  if (value['type'] === 'variable') return { variable: String(value['value']) }
  return undefined
}

const targetOf = (context: Context, to: Json): string => {
  const value = String(to['value'] ?? '')
  if (to['type'] === 'field') return questionIdOf(context, value)
  if (to['type'] === 'thankyou') return value === DEFAULT_SCREEN ? 'end' : `end:${value}`
  return `${String(to['type'])}:${value}`
}

type Operator = 'add' | 'subtract' | 'multiply' | 'divide' | 'set'

/** A calculation step on a variable. */
const calculationOf = (context: Context, verb: string, details: Json) => {
  const operand = operandOf(context, isRecord(details['value']) ? details['value'] : undefined)
  const target = isRecord(details['target']) ? details['target'] : {}
  return {
    kind: 'calculate' as const,
    target: String(target['value'] ?? ''),
    ...optional(
      'operation',
      operand === undefined ? undefined : { operator: verb as Operator, operand }
    ),
  }
}

/** One logic action as a rule: a jump, a calculation step, or another action kept as `other`. */
const ruleOf = (context: Context, logic: Json, action: Json): Rule => {
  const details = isRecord(action['details']) ? action['details'] : {}
  const when = optional(
    'when',
    isRecord(action['condition']) ? conditionOf(context, action['condition']) : undefined
  )
  const raw = { logic: logic['ref'] ?? logic['type'], ...action }
  const verb = String(action['action'] ?? '')
  if (verb === 'jump' && isRecord(details['to'])) {
    const source =
      logic['type'] === 'field' ? questionIdOf(context, String(logic['ref'])) : undefined
    return {
      kind: 'jump',
      ...optional('source', source),
      ...when,
      target: targetOf(context, details['to']),
      raw,
    }
  }
  if (ARITHMETIC.has(verb) && isRecord(details['target'])) {
    return { ...calculationOf(context, verb, details), ...when, raw }
  }
  return { kind: 'other', ...when, raw }
}

/** The thank-you screen shown when no jump picks another. */
const thankYouOf = (form: Json): CanonicalForm['thankYou'] => {
  const screens = objectsOf(form['thankyou_screens'])
  const screen = screens.find((one) => one['ref'] === DEFAULT_SCREEN) ?? screens[0]
  if (screen === undefined) return undefined
  const properties = isRecord(screen['properties']) ? screen['properties'] : {}
  return {
    ...(textOf(screen['title']) === undefined ? {} : { title: String(screen['title']) }),
    ...(textOf(properties['description']) === undefined
      ? {}
      : { message: String(properties['description']) }),
    ...(screen['type'] === 'url_redirect' && typeof properties['redirect_url'] === 'string'
      ? { redirectUrl: properties['redirect_url'] }
      : {}),
  }
}

/** The variables a form computes, each with the value it starts from. */
const variablesOf = (form: Json) =>
  Object.entries(isRecord(form['variables']) ? form['variables'] : {}).map(([name, initial]) => ({
    name,
    ...optional('initial', typeof initial === 'number' ? initial : undefined),
    kind: typeof initial === 'string' ? ('text' as const) : ('number' as const),
  }))

/** The welcome screen's text, read as the form's introduction. */
const welcomeOf = (form: Json): string | undefined => {
  const [welcome] = objectsOf(form['welcome_screens'])
  return isRecord(welcome?.['properties'])
    ? textOf(welcome['properties']['description'])
    : undefined
}

/** Whether a JSON document is a Typeform form definition. */
export const isTypeformForm = (json: unknown): boolean =>
  isRecord(json) &&
  typeof json['id'] === 'string' &&
  typeof json['title'] === 'string' &&
  Array.isArray(json['fields']) &&
  objectsOf(json['fields']).every(
    (field) => typeof field['type'] === 'string' && 'title' in field
  ) &&
  ('logic' in json || 'thankyou_screens' in json || 'hidden' in json || '_links' in json)

/** Read a Typeform snapshot (or a definition file) into a `CanonicalForm`. */
export const adaptTypeformSnapshot = (files: ReadonlyMap<string, unknown>): CanonicalForm => {
  const snapshot = readFormSnapshot(files)
  const form = isRecord(snapshot.definition) ? snapshot.definition : {}
  const layout = layoutOf(objectsOf(form['fields']))
  const context: Context = {
    byRef: new Map(
      layout.questions.flatMap((question) =>
        question.ref === undefined ? [] : [[question.ref, question] as const]
      )
    ),
  }
  const variables = variablesOf(form)
  const read = typeformResponsesOf(
    snapshot.pages,
    layout.questions,
    new Set(variables.map((one) => one.name)),
    snapshot.assets
  )
  const thankYou = thankYouOf(form)
  return {
    tool: 'typeform',
    sourceId: String(form['id'] ?? 'form'),
    title: textOf(form['title']) ?? 'Typeform form',
    ...optional('description', welcomeOf(form)),
    questions: [...layout.questions, ...read.retired],
    pages: layout.pages,
    rules: objectsOf(form['logic']).flatMap((logic) =>
      objectsOf(logic['actions']).map((action) => ruleOf(context, logic, action))
    ),
    hiddenFields: Array.isArray(form['hidden'])
      ? form['hidden'].filter((one) => typeof one === 'string')
      : [],
    ...optional('variables', variables.length === 0 ? undefined : variables),
    ...optional('thankYou', thankYou),
    definitionInferred: false,
    responses: oldestFirst(read.responses),
  }
}
