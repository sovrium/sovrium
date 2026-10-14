/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The built-in `ask_user` tool ([internal ref] D3): an agent chatting with a person
 * asks her a short, structured question and waits for the answer.
 *
 * Shaped like the form mode of MCP elicitation: a `message` and a
 * `requestedSchema` that is a FLAT object of primitive fields — strings
 * (optionally an `enum` of choices, or a `format`), numbers, integers and
 * booleans — plus a `required` list. Pure: this module reads the model's call,
 * checks an answer against the question it answers, and words what the model
 * reads back. Pausing and resuming the turn is the agent runtime's.
 */

import type { ChatToolDefinition } from './ai-chat-tools'

/** The built-in tool through which an agent asks the person it is chatting with. */
export const ASK_USER_TOOL_NAME = 'ask_user'

/**
 * How long a question waits for its answer — the agent's own and an external
 * MCP server's alike. Past it, the question closes: the person can no longer
 * answer it, and a server's question is answered `cancel`.
 */
export const ELICITATION_TTL_MS = 60 * 60 * 1000

/** The most fields one question may hold: a short form, not a survey. */
const MAX_FIELDS = 12

/**
 * The form is the model's, and the model's output is untrusted: it is held in
 * memory until answered and drawn in the window, so each of its texts is
 * bounded, and so is every answer the person sends back.
 */
const LIMITS = {
  message: 2000,
  name: 64,
  title: 200,
  description: 1000,
  choices: 50,
  choice: 200,
  /** The longest text answer, whatever `maxLength` the model asked for. */
  answer: 4000,
} as const

/** Field names that would shadow an object's own machinery. */
const RESERVED_NAMES: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])

/** The formats a string field may ask for. */
const STRING_FORMATS = ['date', 'date-time', 'email', 'uri'] as const

/** One field of a question: a string, a number, an integer or a boolean. */
export type ElicitationField =
  | {
      readonly type: 'string'
      readonly title: string
      readonly description?: string
      readonly enum?: readonly string[]
      readonly format?: (typeof STRING_FORMATS)[number]
      readonly minLength?: number
      readonly maxLength?: number
    }
  | {
      readonly type: 'number' | 'integer'
      readonly title: string
      readonly description?: string
      readonly minimum?: number
      readonly maximum?: number
    }
  | { readonly type: 'boolean'; readonly title: string; readonly description?: string }

/** The form a question asks the person to fill. */
export interface ElicitationSchema {
  readonly type: 'object'
  readonly properties: Readonly<Record<string, ElicitationField>>
  readonly required: readonly string[]
}

/** A question, as the model asked it and as the window draws it. */
export interface ElicitationRequest {
  readonly message: string
  readonly requestedSchema: ElicitationSchema
}

/** How the person answered: with the form, by skipping it, or by dismissing it. */
export type ElicitationAction = 'accept' | 'decline' | 'cancel'

/** One accepted value. */
export type ElicitationValue = string | number | boolean

/** The answer the model is handed. */
export interface ElicitationAnswer {
  readonly action: ElicitationAction
  readonly content?: Readonly<Record<string, ElicitationValue>>
}

/** What the model is told when its question cannot be shown. */
const FLAT_ONLY =
  'ask_user takes a flat form: each field must be a string, a number, an integer or a boolean, never an object or a list. Ask again with flat fields, or ask in prose.'

/** What the model is told when its question is too large to show. */
const TOO_LARGE = `ask_user takes a short form: at most ${String(MAX_FIELDS)} fields, each named in at most ${String(LIMITS.name)} characters, a title of at most ${String(LIMITS.title)}, a description of at most ${String(LIMITS.description)}, and at most ${String(LIMITS.choices)} choices of at most ${String(LIMITS.choice)} characters each. Ask again with a shorter form, or ask in prose.`

/** The `ask_user` definition, as advertised to the model. */
export const askUserToolDefinition = (): ChatToolDefinition => ({
  type: 'function',
  function: {
    name: ASK_USER_TOOL_NAME,
    description:
      'Ask the person you are chatting with a short question, as a form, and wait for the answer: a choice, a date, a number, a yes or no, a short text. Use it when you are missing something you need, rather than guessing. The fields must be flat.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The question, in one sentence.' },
        requestedSchema: {
          type: 'object',
          description:
            'The form: `{ type: "object", properties, required }`. Each property is `{ type: "string" | "number" | "integer" | "boolean", title }`; a string may add `enum` (the choices) or `format` (date, date-time, email, uri).',
        },
      },
      required: ['message', 'requestedSchema'],
    },
  },
})

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const optionalText = (value: unknown): { readonly description?: string } =>
  typeof value === 'string' && value.trim() !== '' ? { description: value } : {}

/** Whether `value`, when it is text, is at most `max` characters. */
const within = (value: unknown, max: number): boolean =>
  typeof value !== 'string' || value.length <= max

/** Whether a field's own texts fit their bounds. */
const fitsLimits = (name: string, raw: Readonly<Record<string, unknown>>): boolean => {
  const choices = raw['enum']
  return (
    name.length > 0 &&
    name.length <= LIMITS.name &&
    !RESERVED_NAMES.has(name) &&
    within(raw['title'], LIMITS.title) &&
    within(raw['description'], LIMITS.description) &&
    (!Array.isArray(choices) ||
      (choices.length <= LIMITS.choices &&
        choices.every((choice) => within(choice, LIMITS.choice))))
  )
}

const optionalNumber = <K extends string>(key: K, value: unknown): Partial<Record<K, number>> =>
  typeof value === 'number' && Number.isFinite(value)
    ? ({ [key]: value } as Partial<Record<K, number>>)
    : {}

/** A string field's own keys, kept when they are well formed. */
const stringField = (
  raw: Readonly<Record<string, unknown>>,
  title: string
): ElicitationField | undefined => {
  const choices = raw['enum']
  if (choices !== undefined) {
    const valid =
      Array.isArray(choices) &&
      choices.length > 0 &&
      choices.every((choice) => typeof choice === 'string')
    if (!valid) return undefined
  }
  const format = STRING_FORMATS.find((candidate) => candidate === raw['format'])
  return {
    type: 'string',
    title,
    ...optionalText(raw['description']),
    ...(Array.isArray(choices) && { enum: choices as readonly string[] }),
    ...(format !== undefined && { format }),
    ...optionalNumber('minLength', raw['minLength']),
    ...optionalNumber('maxLength', raw['maxLength']),
  }
}

/** One property of the model's schema, read; `undefined` when it is not a flat field. */
const readField = (name: string, raw: unknown): ElicitationField | undefined => {
  if (!isRecord(raw)) return undefined
  const title = typeof raw['title'] === 'string' && raw['title'].trim() !== '' ? raw['title'] : name
  switch (raw['type']) {
    case 'string':
      return stringField(raw, title)
    case 'number':
    case 'integer':
      return {
        type: raw['type'],
        title,
        ...optionalText(raw['description']),
        ...optionalNumber('minimum', raw['minimum']),
        ...optionalNumber('maximum', raw['maximum']),
      }
    case 'boolean':
      return { type: 'boolean', title, ...optionalText(raw['description']) }
    default:
      return undefined
  }
}

/** The model's schema, read field by field; why it cannot be shown when any field is not flat or too large. */
const readSchema = (raw: unknown): ElicitationSchema | string => {
  if (!isRecord(raw) || !isRecord(raw['properties'])) return FLAT_ONLY
  const entries = Object.entries(raw['properties'])
  if (entries.length === 0) return FLAT_ONLY
  if (entries.length > MAX_FIELDS) return TOO_LARGE
  if (entries.some(([name, field]) => isRecord(field) && !fitsLimits(name, field))) return TOO_LARGE
  const fields = entries.map(([name, field]) => [name, readField(name, field)] as const)
  if (fields.some(([, field]) => field === undefined)) return FLAT_ONLY
  const names = new Set(entries.map(([name]) => name))
  const required = Array.isArray(raw['required'])
    ? raw['required'].filter((name): name is string => typeof name === 'string' && names.has(name))
    : []
  return {
    type: 'object',
    properties: Object.fromEntries(fields) as Record<string, ElicitationField>,
    required,
  }
}

/** An `ask_user` call's arguments, read: the question, or why it cannot be shown. */
export type AskUserCall =
  | { readonly kind: 'question'; readonly question: ElicitationRequest }
  | { readonly kind: 'invalid'; readonly message: string }

/** Read an `ask_user` call. A nested or empty form is refused, worded for the model. */
export const parseAskUserArguments = (args: Readonly<Record<string, unknown>>): AskUserCall => {
  const { message } = args
  if (typeof message !== 'string' || message.trim() === '') {
    return { kind: 'invalid', message: 'ask_user needs a message: the question, in one sentence.' }
  }
  if (message.length > LIMITS.message) {
    return {
      kind: 'invalid',
      message: `ask_user's message must be at most ${String(LIMITS.message)} characters: ask in one sentence.`,
    }
  }
  const requestedSchema = readSchema(args['requestedSchema'])
  return typeof requestedSchema === 'string'
    ? { kind: 'invalid', message: requestedSchema }
    : { kind: 'question', question: { message, requestedSchema } }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
/** A date and a time, RFC 3339 in shape, the seconds and the offset optional (a browser's local time sends neither). */
const DATE_TIME =
  /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Whether `value` is a calendar date written `YYYY-MM-DD`. */
const isCalendarDate = (value: string): boolean => {
  if (!DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

const FORMAT_CHECKS: Readonly<Record<(typeof STRING_FORMATS)[number], (value: string) => boolean>> =
  {
    date: isCalendarDate,
    'date-time': (value) => {
      const day = DATE_TIME.exec(value)?.[1]
      return day !== undefined && isCalendarDate(day) && !Number.isNaN(Date.parse(value))
    },
    email: (value) => EMAIL.test(value),
    uri: (value) => URL.canParse(value),
  }

/** Why a string value does not fit its field, or `undefined` when it does. */
const stringProblem = (
  field: Extract<ElicitationField, { readonly type: 'string' }>,
  value: string
): string | undefined => {
  if (field.enum !== undefined && !field.enum.includes(value)) {
    return `must be one of: ${field.enum.join(', ')}`
  }
  if (field.format !== undefined && !FORMAT_CHECKS[field.format](value)) {
    return field.format === 'date'
      ? 'must be a date, written YYYY-MM-DD'
      : `must be ${field.format}`
  }
  if (field.minLength !== undefined && value.length < field.minLength) {
    return `must be at least ${String(field.minLength)} characters`
  }
  const maxLength = Math.min(field.maxLength ?? LIMITS.answer, LIMITS.answer)
  if (value.length > maxLength) return `must be at most ${String(maxLength)} characters`
  return undefined
}

/** Why a number does not fit its field, or `undefined` when it does. */
const numberProblem = (
  field: Extract<ElicitationField, { readonly type: 'number' | 'integer' }>,
  value: number
): string | undefined => {
  if (field.type === 'integer' && !Number.isInteger(value)) return 'must be a whole number'
  if (field.minimum !== undefined && value < field.minimum) {
    return `must be at least ${String(field.minimum)}`
  }
  if (field.maximum !== undefined && value > field.maximum) {
    return `must be at most ${String(field.maximum)}`
  }
  return undefined
}

/** Why one value does not fit its field, or `undefined` when it does. */
const valueProblem = (field: ElicitationField, value: unknown): string | undefined => {
  switch (field.type) {
    case 'string':
      return typeof value === 'string' ? stringProblem(field, value) : 'must be text'
    case 'number':
    case 'integer':
      return typeof value === 'number' && Number.isFinite(value)
        ? numberProblem(field, value)
        : 'must be a number'
    case 'boolean':
      return typeof value === 'boolean' ? undefined : 'must be true or false'
  }
}

/** An answer's content, checked against its question. */
export type ElicitationContentCheck =
  | { readonly ok: true; readonly content: Readonly<Record<string, ElicitationValue>> }
  | { readonly ok: false; readonly field: string; readonly message: string }

/**
 * Check an accepted answer against the question it answers: every required
 * field present, every value of its field's type, inside its choices and
 * bounds, and no field the question did not ask. The first problem, in the
 * question's own order, is the one reported.
 */
export const checkElicitationContent = (
  schema: ElicitationSchema,
  content: unknown
): ElicitationContentCheck => {
  if (!isRecord(content)) {
    return { ok: false, field: '', message: 'The answer must be an object of the fields asked.' }
  }
  // Own fields only: `toString` or `__proto__` is no field of any question.
  const unknown = Object.keys(content).find((name) => !Object.hasOwn(schema.properties, name))
  if (unknown !== undefined) {
    return { ok: false, field: unknown, message: `"${unknown}" is not a field of this question.` }
  }
  const problems = Object.entries(schema.properties).flatMap(([name, field]) => {
    const value = Object.hasOwn(content, name) ? content[name] : undefined
    if (value === undefined || value === null || value === '') {
      return schema.required.includes(name) ? [{ name, problem: 'is required' }] : []
    }
    const problem = valueProblem(field, value)
    return problem === undefined ? [] : [{ name, problem }]
  })
  const [first] = problems
  if (first !== undefined) {
    return { ok: false, field: first.name, message: `"${first.name}" ${first.problem}.` }
  }
  const kept = Object.entries(content).filter(([, value]) => value !== null && value !== '')
  return { ok: true, content: Object.fromEntries(kept) as Record<string, ElicitationValue> }
}

/** What the model reads beside the answer, by how the person answered. */
const ANSWER_NOTES: Readonly<Record<ElicitationAction, string>> = {
  accept: 'The person answered your question.',
  decline:
    'The person chose not to answer your question. Go on without the answer, and do not ask it again unless they bring it up.',
  cancel:
    'The person dismissed your question without answering it. Go on without the answer, and do not ask it again unless they bring it up.',
}

/**
 * What the model is handed as `ask_user`'s result: the answer as JSON, in the
 * shape of an MCP elicitation result, then a sentence saying what it means. A
 * declined or dismissed question carries no content.
 */
export const elicitationResultText = (answer: ElicitationAnswer): string =>
  `${JSON.stringify(
    answer.action === 'accept'
      ? { action: 'accept', content: answer.content ?? {} }
      : { action: answer.action }
  )}\n${ANSWER_NOTES[answer.action]}`
