/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The date functions that read a part of a date: its year, month, day, hour,
 * minute and second, and a date written out with a format.
 *
 * ## Why only a field, and only through its text
 *
 * These emitters predate `date_part_utc` and read a part through what both
 * engines already shared before it: the date's ISO text,
 * `YYYY-MM-DD` for a date and `YYYY-MM-DD?HH:MM:SS…` for a date and time, and
 * `SUBSTR` over it. SQLite stores exactly that text. PostgreSQL prints it once
 * the session reads dates as ISO in UTC, and the engine pins both settings for
 * every formula that casts a `date` or `datetime` FIELD to text, computing it
 * on write rather than as a generated column.
 *
 * That pin is keyed on the field's type, so these emitters read only a plain
 * `date` or `datetime` field. A date that comes out of another formula, a
 * lookup, the record's creation time or the clock is refused: PostgreSQL would
 * print it through whatever date style and time zone the server runs with.
 *
 * Airtable computes these functions in UTC (GMT) unless a formula sets a time
 * zone, which this importer does not translate, so a date and time read in
 * UTC is exactly what Airtable shows. Notion reads a date and time in the
 * viewer's time zone, so its functions read only a date without a time.
 */

import { segmentMomentPattern, type MomentSegment } from './date-format-conversion-service'
import { DAY_ARITHMETIC_EMITTERS } from './formula-day-arithmetic-emitters-service'
import {
  PRECEDENCE,
  composed,
  refuse,
  sqlString,
  type EmitContext,
  type Emitted,
} from './formula-emit-primitives-service'
import type { FormulaNode } from './formula-ast'
import type { FieldType } from '@/domain/models/app/tables/fields/field'

type Special = (args: readonly FormulaNode[], context: EmitContext) => Emitted

/** A part of the ISO text: where it starts and how many characters it spans. */
interface TextSlice {
  readonly start: number
  readonly length: number
  /** Whether only a date and time carries it. */
  readonly time: boolean
}

const YEAR: TextSlice = { start: 1, length: 4, time: false }
const SHORT_YEAR: TextSlice = { start: 3, length: 2, time: false }
const MONTH: TextSlice = { start: 6, length: 2, time: false }
const DAY: TextSlice = { start: 9, length: 2, time: false }
const HOUR: TextSlice = { start: 12, length: 2, time: true }
const MINUTE: TextSlice = { start: 15, length: 2, time: true }
const SECOND: TextSlice = { start: 18, length: 2, time: true }

/** The field types whose ISO text both engines agree on, per dialect. */
const READABLE: Readonly<Record<EmitContext['dialect'], readonly FieldType[]>> = {
  airtable: ['date', 'datetime'],
  notion: ['date'],
}

const describeReadable = (types: readonly FieldType[]): string =>
  types.length === 1 ? 'a date field' : 'a date or date-and-time field'

/**
 * The one field a date function reads, emitted; refused when the argument is
 * anything but a plain field of a readable type, or when the slices it reads
 * include a time and the field holds none.
 */
const datedField = (
  what: string,
  node: FormulaNode | undefined,
  context: EmitContext,
  readsTime: boolean
): Emitted => {
  const readable = READABLE[context.dialect]
  if (node === undefined) return refuse('unsupported', `${what} is missing its date`)
  const piece = context.emit(node)
  const fieldType = node.kind === 'field' ? context.fields.get(node.ref)?.fieldType : undefined
  if (fieldType === undefined || !readable.includes(fieldType)) {
    return refuse(
      'degraded',
      `${what} is translated only over ${describeReadable(readable)} itself, whose stored text both engines read alike`
    )
  }
  return readsTime && fieldType !== 'datetime'
    ? refuse('degraded', `${what} reads a time, and a date field holds none`)
    : piece
}

/** `SUBSTR` of the field's ISO text. */
const sliceSql = (field: Emitted, slice: TextSlice): string =>
  `SUBSTR(CAST(${field.sql} AS TEXT), ${slice.start}, ${slice.length})`

/** A slice read as a number. */
const sliceNumberSql = (field: Emitted, slice: TextSlice): string =>
  `CAST(${sliceSql(field, slice)} AS INTEGER)`

/** A date part as a number: `YEAR({Due})`; `what` names it in a refusal. */
const datePart =
  (what: string, slice: TextSlice): Special =>
  (args, context) => {
    const field = datedField(what, args[0], context, slice.time)
    return composed(sliceNumberSql(field, slice), 'number', PRECEDENCE.atom, [field])
  }

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** The month's English name, full or in three letters, as Airtable's default locale prints it. */
const monthNameSql = (field: Emitted, length: number | undefined): string => {
  const whens = MONTH_NAMES.map(
    (name, index) =>
      `WHEN '${String(index + 1).padStart(2, '0')}' THEN '${name.slice(0, length ?? name.length)}'`
  )
  return `CASE ${sliceSql(field, MONTH)} ${whens.join(' ')} END`
}

/** A slice without its leading zero: `9`, not `09`. */
const unpaddedSql = (field: Emitted, slice: TextSlice): string =>
  `CAST(${sliceNumberSql(field, slice)} AS TEXT)`

/** What each Moment.js token prints, and whether it reads a time. */
const FORMAT_TOKENS: Readonly<
  Record<string, { readonly sql: (field: Emitted) => string; readonly time: boolean }>
> = {
  YYYY: { sql: (field) => sliceSql(field, YEAR), time: false },
  YY: { sql: (field) => sliceSql(field, SHORT_YEAR), time: false },
  MMMM: { sql: (field) => monthNameSql(field, undefined), time: false },
  MMM: { sql: (field) => monthNameSql(field, 3), time: false },
  MM: { sql: (field) => sliceSql(field, MONTH), time: false },
  M: { sql: (field) => unpaddedSql(field, MONTH), time: false },
  DD: { sql: (field) => sliceSql(field, DAY), time: false },
  D: { sql: (field) => unpaddedSql(field, DAY), time: false },
  HH: { sql: (field) => sliceSql(field, HOUR), time: true },
  H: { sql: (field) => unpaddedSql(field, HOUR), time: true },
  mm: { sql: (field) => sliceSql(field, MINUTE), time: true },
  ss: { sql: (field) => sliceSql(field, SECOND), time: true },
}

/** The tokens, a longer one before any shorter one it starts with. */
const TOKEN_NAMES = Object.keys(FORMAT_TOKENS).toSorted((a, b) => b.length - a.length)

/** Adjacent printed text merged into one literal; each token its own piece. */
type FormatPiece = { readonly token: string } | { readonly text: string }

const formatPieces = (segments: readonly MomentSegment[]): readonly FormatPiece[] =>
  segments.reduce<readonly FormatPiece[]>((pieces, segment) => {
    if (segment.kind === 'token') return [...pieces, { token: segment.token }]
    const last = pieces.at(-1)
    return last !== undefined && 'text' in last
      ? [...pieces.slice(0, -1), { text: `${last.text}${segment.text}` }]
      : [...pieces, { text: segment.text }]
  }, [])

/** The literal format of a DATETIME_FORMAT call, cut into pieces; refused when it cannot be. */
const literalFormat = (node: FormulaNode | undefined): readonly FormatPiece[] => {
  if (node === undefined) {
    return refuse('degraded', 'DATETIME_FORMAT() without a format prints milliseconds and a zone')
  }
  if (node.kind !== 'string') {
    return refuse('degraded', 'DATETIME_FORMAT() is translated only with a format written out')
  }
  const segments = node.value.includes('\\')
    ? undefined
    : segmentMomentPattern(node.value, TOKEN_NAMES)
  return segments === undefined
    ? refuse(
        'degraded',
        `The format "${node.value}" holds a part with no portable form (only YYYY, YY, MMMM, MMM, MM, M, DD, D, HH, H, mm and ss translate)`
      )
    : formatPieces(segments)
}

/** `DATETIME_FORMAT({Due}, 'DD/MM/YYYY')` as the ISO text cut and joined. */
const datetimeFormat: Special = (args, context) => {
  const pieces = literalFormat(args[1])
  const readsTime = pieces.some(
    (piece) => 'token' in piece && FORMAT_TOKENS[piece.token]?.time === true
  )
  const field = datedField('DATETIME_FORMAT()', args[0], context, readsTime)
  const parts = pieces.map((piece) =>
    'token' in piece ? (FORMAT_TOKENS[piece.token]?.sql(field) ?? "''") : sqlString(piece.text).sql
  )
  if (parts.length === 0) return sqlString('')
  const joined = parts.join(' || ')
  return composed(parts.length === 1 ? joined : `(${joined})`, 'text', PRECEDENCE.atom, [field])
}

/** The date emitters, by the name a table row uses. */
export const DATE_EMITTERS = {
  year: datePart('Reading the year', YEAR),
  month: datePart('Reading the month', MONTH),
  day: datePart('Reading the day of the month', DAY),
  hour: datePart('Reading the hour', HOUR),
  minute: datePart('Reading the minute', MINUTE),
  second: datePart('Reading the second', SECOND),
  datetimeFormat,
  ...DAY_ARITHMETIC_EMITTERS,
} as const satisfies Readonly<Record<string, Special>>
