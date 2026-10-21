/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Airtable's day arithmetic, weekday and `FIND`, emitted over the portable
 * formula functions: `days_between`, `add_days`, `date_part_utc` and
 * `strpos`. Each answers the same on SQLite and PostgreSQL, in UTC, which is
 * the zone Airtable computes these functions in unless a formula sets one.
 *
 * Only what keeps Airtable's meaning translates:
 *
 * - `DATETIME_DIFF` over two DATE fields, in days or weeks. Between two
 *   date-and-time fields Airtable counts elapsed time, while `days_between`
 *   counts calendar days, so that call keeps its values.
 * - `DATEADD` of days or weeks to a DATE field. Added to a date and time,
 *   Airtable keeps the time, while `add_days` returns a day.
 * - Months, quarters and years in either: a month added to 31 January has
 *   no answer both engines share, so none is emitted.
 * - `WEEKDAY`, from Sunday or (with `'Monday'`) from Monday.
 * - `FIND` with two arguments; a start position has no counterpart.
 */

import { arithmetic } from './formula-emit-operators-service'
import {
  PRECEDENCE,
  atom,
  composed,
  integerArgument,
  literalInteger,
  refuse,
  sqlNumber,
  typed,
  type EmitContext,
  type Emitted,
} from './formula-emit-primitives-service'
import type { FormulaNode } from './formula-ast'
import type { FieldType } from '@/domain/models/app/tables/fields/field'

type Special = (args: readonly FormulaNode[], context: EmitContext) => Emitted

/** The unit a day-arithmetic call names: a day or a week, in days. */
const DAY_UNITS: Readonly<Record<string, number>> = {
  days: 1,
  day: 1,
  d: 1,
  weeks: 7,
  week: 7,
  w: 7,
}

/** How many days a literal unit counts; refused when it is not a day or a week. */
const daysPerUnit = (what: string, node: FormulaNode | undefined): number => {
  if (node?.kind !== 'string') {
    return refuse(
      'degraded',
      `${what} is translated only with its unit written out as days or weeks`
    )
  }
  // A one-letter unit is case-sensitive in Airtable (`m` is minutes, `M` months)
  const days = DAY_UNITS[node.value.length === 1 ? node.value : node.value.toLowerCase()]
  return days === undefined
    ? refuse(
        'degraded',
        `${what} in "${node.value}" keeps its values: only days and weeks have an answer both engines share`
      )
    : days
}

/** Which field types a call reads, and why any other argument keeps its values. */
interface FieldRule {
  readonly allowed: readonly FieldType[]
  readonly otherwise: string
}

/** The one field a call reads, emitted; refused unless it is a field of an allowed type. */
const fieldOf = (
  what: string,
  node: FormulaNode | undefined,
  context: EmitContext,
  rule: FieldRule
): Emitted => {
  if (node === undefined) return refuse('unsupported', `${what} is missing its date`)
  const fieldType = node.kind === 'field' ? context.fields.get(node.ref)?.fieldType : undefined
  return fieldType !== undefined && rule.allowed.includes(fieldType)
    ? context.emit(node)
    : refuse('degraded', `${what} ${rule.otherwise}`)
}

const OVER_DATE_FIELD = 'is translated only over a date field itself'
const NOT_ELAPSED =
  'is translated only between two date fields: between two date-and-time fields Airtable counts elapsed time, where Sovrium counts calendar days'

/** `DATETIME_DIFF({Due}, {Start}, 'days')` → `days_between(due, start)`, weeks divided by 7. */
const daysBetween: Special = (args, context) => {
  const perUnit = daysPerUnit('DATETIME_DIFF()', args[2])
  const [later, earlier] = [args[0], args[1]].map((node) =>
    fieldOf('DATETIME_DIFF()', node, context, { allowed: ['date'], otherwise: NOT_ELAPSED })
  )
  const pieces = [later ?? sqlNumber(0), earlier ?? sqlNumber(0)]
  const days = composed(
    `days_between(${pieces.map((piece) => piece.sql).join(', ')})`,
    'number',
    PRECEDENCE.atom,
    pieces
  )
  // Both engines divide two integers by truncating toward zero, as Airtable does.
  return perUnit === 1
    ? days
    : composed(`${days.sql} / ${String(perUnit)}`, 'number', PRECEDENCE.multiply, [days])
}

/** The count of days a `DATEADD` adds: a literal folded, any other number multiplied. */
const dayCount = (count: Emitted, perUnit: number): Emitted => {
  const literal = literalInteger(count)
  if (literal !== undefined) return sqlNumber(literal * perUnit)
  return perUnit === 1 ? count : arithmetic('*', count, sqlNumber(perUnit))
}

/** `DATEADD({Due}, 2, 'weeks')` → `add_days(due, 14)`. */
const dateAdd: Special = (args, context) => {
  const perUnit = daysPerUnit('DATEADD()', args[2])
  const day = fieldOf('DATEADD()', args[0], context, {
    allowed: ['date'],
    otherwise: `${OVER_DATE_FIELD}: added to a date and time, Airtable keeps the time`,
  })
  const count = integerArgument(
    'DATEADD()',
    args[1] === undefined ? sqlNumber(0) : context.emit(args[1])
  )
  const days = dayCount(count, perUnit)
  return composed(`add_days(${day.sql}, ${days.sql})`, 'date', PRECEDENCE.atom, [day, days])
}

/** `WEEKDAY({Due})` → `date_part_utc('dow', due)`: 0 for Sunday, or for Monday with `'Monday'`. */
const weekday: Special = (args, context) => {
  const day = fieldOf('WEEKDAY()', args[0], context, {
    allowed: ['date', 'datetime'],
    otherwise: 'is translated only over a date or date-and-time field itself, read in UTC',
  })
  const start = args[1]
  const fromMonday = start?.kind === 'string' && start.value.toLowerCase() === 'monday'
  if (
    start !== undefined &&
    !fromMonday &&
    !(start.kind === 'string' && /^sunday$/i.test(start.value))
  ) {
    return refuse('degraded', "WEEKDAY() is translated only from 'Sunday' or 'Monday'")
  }
  const dow = composed(`date_part_utc('dow', ${day.sql})`, 'number', PRECEDENCE.atom, [day])
  return fromMonday ? composed(`MOD(${dow.sql} + 6, 7)`, 'number', PRECEDENCE.atom, [dow]) : dow
}

/** `FIND('-', {Ref})` → `strpos(ref, '-')`; a start position keeps its values. */
const find: Special = (args, context) => {
  if (args.length > 2) {
    return refuse(
      'degraded',
      'FIND() with a start position has no counterpart in a Sovrium formula'
    )
  }
  const [needle, haystack] = [args[0], args[1]].map((node) =>
    typed('FIND()', 'text', node === undefined ? atom('NULL', 'null') : context.emit(node))
  )
  const pieces = [haystack ?? atom('NULL', 'null'), needle ?? atom('NULL', 'null')]
  return composed(
    `strpos(${pieces.map((piece) => piece.sql).join(', ')})`,
    'number',
    PRECEDENCE.atom,
    pieces
  )
}

/** The day-arithmetic emitters, by the name a table row uses. */
export const DAY_ARITHMETIC_EMITTERS = {
  daysBetween,
  dateAdd,
  weekday,
  find,
} as const satisfies Readonly<Record<string, Special>>
