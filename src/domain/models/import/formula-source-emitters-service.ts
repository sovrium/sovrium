/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The functions whose value the import itself can supply: the source's record
 * id, which every imported table keeps in `source_id`, and a number or a date
 * written out as text in the formula, read once here rather than by the
 * database on every write.
 *
 * Reading a literal at import time is what makes it exact. A cast of text to a
 * number refuses text that is not one on PostgreSQL and reads its leading
 * digits on SQLite; a cast of text to a date follows the server's date style.
 * A literal read here is the same number or date on both engines.
 */

import { segmentMomentPattern, type MomentSegment } from './date-format-conversion-service'
import { SOURCE_ID_FIELD } from './field-type-mappings'
import {
  atom,
  refuse,
  sqlNumber,
  type EmitContext,
  type Emitted,
} from './formula-emit-primitives-service'
import type { FormulaNode } from './formula-ast'

type Special = (args: readonly FormulaNode[], context: EmitContext) => Emitted

/** `RECORD_ID()`: the imported record's Airtable id. */
const recordId: Special = () => atom(SOURCE_ID_FIELD, 'text')

const DECIMAL = /^-?\d+(?:\.\d+)?$/

/**
 * `VALUE(x)` / `toNumber(x)`: a number stays itself, text written as a plain
 * decimal is read here; anything else is refused.
 */
const value: Special = (args, context) => {
  const [node] = args
  if (node?.kind === 'string' && DECIMAL.test(node.value.trim())) {
    return sqlNumber(Number(node.value.trim()))
  }
  const piece = context.emit(node ?? { kind: 'boolean', value: false })
  if (piece.type === 'number' || piece.type === 'null') return piece
  return refuse(
    piece.type === 'unknown' ? 'unsupported' : 'degraded',
    'The source reads a number out of any text, where a cast refuses text that is not one; only a number, or text written out as one, translates'
  )
}

/** The parts of a day: year, month, day of the month. */
interface Day {
  readonly year?: number
  readonly month?: number
  readonly day?: number
}

const PARSE_TOKENS = ['YYYY', 'MM', 'DD', 'M', 'D'] as const
const DIGITS: Readonly<Record<(typeof PARSE_TOKENS)[number], RegExp>> = {
  YYYY: /^\d{4}/,
  MM: /^\d{1,2}/,
  DD: /^\d{1,2}/,
  M: /^\d{1,2}/,
  D: /^\d{1,2}/,
}
const PART: Readonly<Record<(typeof PARSE_TOKENS)[number], keyof Day>> = {
  YYYY: 'year',
  MM: 'month',
  M: 'month',
  DD: 'day',
  D: 'day',
}

interface Reading {
  readonly rest: string
  readonly day: Day
}

/** One segment read off the front of the text; `undefined` when the text does not match it. */
const readSegment = (state: Reading, segment: MomentSegment): Reading | undefined => {
  if (segment.kind !== 'token') {
    return state.rest.startsWith(segment.text)
      ? { rest: state.rest.slice(segment.text.length), day: state.day }
      : undefined
  }
  const token = segment.token as (typeof PARSE_TOKENS)[number]
  const digits = DIGITS[token].exec(state.rest)?.[0]
  return digits === undefined
    ? undefined
    : {
        rest: state.rest.slice(digits.length),
        day: { ...state.day, [PART[token]]: Number(digits) },
      }
}

/** The day `text` spells under `segments`, every character accounted for; `undefined` otherwise. */
const readDay = (text: string, segments: readonly MomentSegment[]): Day | undefined => {
  const read = segments.reduce<Reading | undefined>(
    (state, segment) => (state === undefined ? undefined : readSegment(state, segment)),
    { rest: text, day: {} }
  )
  return read?.rest === '' ? read.day : undefined
}

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

const isRealDay = (year: number, month: number, day: number): boolean => {
  const days = (DAYS_IN_MONTH[month - 1] ?? 0) + (month === 2 && isLeapYear(year) ? 1 : 0)
  return year >= 1 && day >= 1 && day <= days
}

const pad = (value: number, width: number): string => String(value).padStart(width, '0')

/** `YYYY-MM-DD` for a day with every part, and a real one; `undefined` otherwise. */
const isoDay = (day: Day | undefined): string | undefined => {
  if (day?.year === undefined || day.month === undefined || day.day === undefined) return undefined
  return isRealDay(day.year, day.month, day.day)
    ? `${pad(day.year, 4)}-${pad(day.month, 2)}-${pad(day.day, 2)}`
    : undefined
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

const isoSegments: readonly MomentSegment[] = [
  { kind: 'token', token: 'YYYY' },
  { kind: 'text', text: '-' },
  { kind: 'token', token: 'MM' },
  { kind: 'text', text: '-' },
  { kind: 'token', token: 'DD' },
]

/** The day a literal DATETIME_PARSE call names, as `YYYY-MM-DD`; `undefined` when it names none. */
export const parsedDay = (text: string, format: string | undefined): string | undefined => {
  if (format === undefined)
    return ISO_DAY.test(text) ? isoDay(readDay(text, isoSegments)) : undefined
  const segments = segmentMomentPattern(format, PARSE_TOKENS)
  return segments === undefined ? undefined : isoDay(readDay(text, segments))
}

/** `DATETIME_PARSE('30/09/2020', 'DD/MM/YYYY')`: a day written out, read here. */
const datetimeParse: Special = (args) => {
  const [text, format, locale] = args
  if (locale !== undefined)
    return refuse('degraded', 'DATETIME_PARSE() with a locale reads month names')
  if (text?.kind !== 'string' || (format !== undefined && format.kind !== 'string')) {
    return refuse(
      'degraded',
      'DATETIME_PARSE() is translated only when the text and its format are written out'
    )
  }
  const day = parsedDay(text.value, format?.value)
  return day === undefined
    ? refuse(
        'degraded',
        `DATETIME_PARSE() reads "${text.value}" as no single day with a portable form (only YYYY, MM, M, DD and D translate)`
      )
    : atom(`'${day}'`, 'date')
}

/** The emitters whose value the import supplies, by the name a table row uses. */
export const SOURCE_EMITTERS = {
  recordId,
  value,
  datetimeParse,
} as const satisfies Readonly<Record<string, Special>>
