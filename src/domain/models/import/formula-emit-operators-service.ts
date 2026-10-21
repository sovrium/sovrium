/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The operators of the shared formula AST, as Sovrium formula text.
 *
 * Arithmetic takes numbers only: PostgreSQL refuses `text * 2` when the table
 * is created, so a source formula multiplying a text field keeps its values
 * instead. Division multiplies by `1.0` first, because both engines divide two
 * integers as integers and both sources do not, and divides by `NULLIF(…, 0)`,
 * because PostgreSQL refuses to write a row whose formula divides by zero while
 * both sources show an empty or error cell.
 *
 * Comparison keeps the sources' reading of blank: comparing with `BLANK()` or
 * `""` is a test for an empty value, which SQL's `= NULL` never is.
 */

import {
  PRECEDENCE,
  composed,
  concatAll,
  describeType,
  refuse,
  truthy,
  wrap,
  type Emitted,
} from './formula-emit-primitives-service'
import type { FormulaBinaryOperator, FormulaDialect } from './formula-ast'

type Arithmetic = '+' | '-' | '*' | '/' | '%' | '^'

/** Both operands, when both are numbers (or blank); refused otherwise. */
const numbers = (operator: string, left: Emitted, right: Emitted): readonly [Emitted, Emitted] => {
  const wrong = [left, right].find((piece) => piece.type !== 'number' && piece.type !== 'null')
  return wrong === undefined
    ? [left, right]
    : refuse(
        wrong.type === 'unknown' ? 'unsupported' : 'degraded',
        `"${operator}" receives ${describeType(wrong.type)} where it needs a number`
      )
}

const DECIMAL_LITERAL = /^\d+\.\d+$/

const NON_ZERO_LITERAL = /^(?:\d*[1-9]\d*(?:\.\d+)?|\d+\.\d*[1-9]\d*)$/

/** A divisor: a non-zero literal as itself, anything else blank when it is zero. */
const divisor = (right: Emitted): string =>
  NON_ZERO_LITERAL.test(right.sql) ? right.sql : `NULLIF(${right.sql}, 0)`

type NumericEmitter = (left: Emitted, right: Emitted) => Emitted

const infix =
  (operator: '+' | '-' | '*', precedence: number): NumericEmitter =>
  (left, right) =>
    composed(
      `${wrap(left, precedence)} ${operator} ${wrap(right, precedence + 1)}`,
      'number',
      precedence,
      [left, right]
    )

const ARITHMETIC: Readonly<Record<Arithmetic, NumericEmitter>> = {
  '+': infix('+', PRECEDENCE.add),
  '-': infix('-', PRECEDENCE.add),
  '*': infix('*', PRECEDENCE.multiply),
  '/': (left, right) => {
    const dividend = DECIMAL_LITERAL.test(left.sql)
      ? left.sql
      : `${wrap(left, PRECEDENCE.multiply)} * 1.0`
    return composed(`${dividend} / ${divisor(right)}`, 'number', PRECEDENCE.multiply, [left, right])
  },
  '%': (left, right) =>
    composed(`MOD(${left.sql}, ${divisor(right)})`, 'number', PRECEDENCE.atom, [left, right]),
  '^': (left, right) =>
    composed(`POWER(${left.sql}, ${right.sql})`, 'number', PRECEDENCE.atom, [left, right]),
}

/** `left op right` over numbers. */
export const arithmetic = (operator: Arithmetic, left: Emitted, right: Emitted): Emitted =>
  ARITHMETIC[operator](...numbers(operator, left, right))

/** Notion's `+`: text joins, numbers add. */
export const plus = (left: Emitted, right: Emitted): Emitted =>
  left.type === 'text' || right.type === 'text'
    ? concatAll([left, right])
    : arithmetic('+', left, right)

const isTextLiteral = (piece: Emitted): boolean =>
  piece.type === 'text' && piece.sql.startsWith("'")

/** A day written out as `'YYYY-MM-DD'`, the one form both engines read as the same date. */
const isIsoDayLiteral = (piece: Emitted): boolean =>
  piece.type === 'text' && /^'\d{4}-\d{2}-\d{2}'$/.test(piece.sql)

/** The clock: SQLite writes it `YYYY-MM-DD HH:MM:SS`, a stored date and time `YYYY-MM-DDTHH:MM:SS…Z`. */
const isClock = (piece: Emitted): boolean => piece.sql === 'CURRENT_TIMESTAMP'

/**
 * Why two values do not compare the same way on both engines, or `undefined`
 * when they do.
 *
 * - A date with a date and time: PostgreSQL converts the date through the
 *   server's time zone, and refuses the column as a generated one.
 * - Text written out with a date and time: PostgreSQL fixes the text to an
 *   instant in the server's time zone; with a date, only `YYYY-MM-DD` text is
 *   read the same way, whatever the server's date style.
 * - A stored date and time with the clock: SQLite compares them as text, and
 *   writes the two with a different separator.
 */
const isDated = (piece: Emitted): boolean => piece.type === 'date' || piece.type === 'datetime'

/** Why text written out compares differently with a date or a date and time, if it does. */
const literalReason = (literal: Emitted, dated: Emitted): string | undefined => {
  if (dated.type === 'datetime') {
    return "A date and time is compared with text, which PostgreSQL reads in the server's time zone"
  }
  return isIsoDayLiteral(literal)
    ? undefined
    : 'A date is compared with text that is not written YYYY-MM-DD'
}

const incomparable = (left: Emitted, right: Emitted): string | undefined => {
  if (left.type === 'null' || right.type === 'null') return undefined
  if (isTextLiteral(left) && isDated(right)) return literalReason(left, right)
  if (isTextLiteral(right) && isDated(left)) return literalReason(right, left)
  if (left.type !== right.type) {
    return `Comparing ${describeType(left.type)} with ${describeType(right.type)} needs a cast the sources do implicitly`
  }
  return left.type === 'datetime' && isClock(left) !== isClock(right)
    ? 'A date and time is compared with the current time, which SQLite writes in another format'
    : undefined
}

type Comparison = '=' | '!=' | '<' | '<=' | '>' | '>='

const isBlankTest = (piece: Emitted): boolean => piece.type === 'null' || piece.emptyText === true

/** `x = BLANK()` and `x = ""` as a test for an empty value. */
const blankTest = (operator: '=' | '!=', value: Emitted): Emitted => {
  const negate = operator === '!='
  const sql =
    value.type === 'text'
      ? `COALESCE(${value.sql}, '') ${negate ? '<>' : '='} ''`
      : `${wrap(value, PRECEDENCE.compare + 1)} IS ${negate ? 'NOT ' : ''}NULL`
  return composed(sql, 'boolean', PRECEDENCE.compare, [value])
}

const checkedComparison = (operator: Comparison, left: Emitted, right: Emitted): Emitted => {
  if (left.type === 'unknown' || right.type === 'unknown') {
    return refuse('unsupported', 'A comparison reads a value whose type is not known')
  }
  const reason = incomparable(left, right)
  if (reason !== undefined) return refuse('degraded', reason)
  const sqlOperator = operator === '!=' ? '<>' : operator
  return composed(
    `${wrap(left, PRECEDENCE.compare + 1)} ${sqlOperator} ${wrap(right, PRECEDENCE.compare + 1)}`,
    'boolean',
    PRECEDENCE.compare,
    [left, right]
  )
}

/** `left op right`, refused when the two sides are not comparable on both engines. */
export const compare = (operator: Comparison, left: Emitted, right: Emitted): Emitted => {
  const equality = operator === '=' || operator === '!='
  if (!equality || !(isBlankTest(left) || isBlankTest(right))) {
    return checkedComparison(operator, left, right)
  }
  const value = isBlankTest(right) ? left : right
  return isBlankTest(value)
    ? composed(operator === '=' ? 'TRUE' : 'FALSE', 'boolean', PRECEDENCE.atom, [])
    : blankTest(operator, value)
}

/** `a AND b AND …` or `a OR b OR …`, each operand read as a condition. */
export const logical = (operator: 'and' | 'or', operands: readonly Emitted[]): Emitted => {
  const precedence = operator === 'and' ? PRECEDENCE.and : PRECEDENCE.or
  const conditions = operands.map(truthy)
  if (conditions.length === 1 && conditions[0] !== undefined) return conditions[0]
  return composed(
    conditions
      .map((condition) => wrap(condition, precedence + 1))
      .join(` ${operator.toUpperCase()} `),
    'boolean',
    precedence,
    conditions
  )
}

/** `NOT (x)`. */
export const negation = (operand: Emitted): Emitted => {
  const condition = truthy(operand)
  return composed(`NOT ${wrap(condition, PRECEDENCE.atom)}`, 'boolean', PRECEDENCE.not, [condition])
}

/** `(-x)`: parenthesised, so no operator ever precedes it directly. */
export const minus = (operand: Emitted): Emitted => {
  const [number] = numbers('-', operand, operand)
  return composed(`(-${wrap(number, PRECEDENCE.multiply)})`, 'number', PRECEDENCE.atom, [number])
}

type BinaryEmitter = (left: Emitted, right: Emitted, dialect: FormulaDialect) => Emitted

const BINARY: Readonly<Record<FormulaBinaryOperator, BinaryEmitter>> = {
  '&': (left, right) => concatAll([left, right]),
  '+': (left, right, dialect) =>
    dialect === 'notion' ? plus(left, right) : arithmetic('+', left, right),
  '-': (left, right) => arithmetic('-', left, right),
  '*': (left, right) => arithmetic('*', left, right),
  '/': (left, right) => arithmetic('/', left, right),
  '%': (left, right) => arithmetic('%', left, right),
  '^': (left, right) => arithmetic('^', left, right),
  and: (left, right) => logical('and', [left, right]),
  or: (left, right) => logical('or', [left, right]),
  '=': (left, right) => compare('=', left, right),
  '!=': (left, right) => compare('!=', left, right),
  '<': (left, right) => compare('<', left, right),
  '<=': (left, right) => compare('<=', left, right),
  '>': (left, right) => compare('>', left, right),
  '>=': (left, right) => compare('>=', left, right),
}

/** One binary node of the shared AST. */
export const binary = (
  operator: FormulaBinaryOperator,
  left: Emitted,
  right: Emitted,
  dialect: FormulaDialect
): Emitted => BINARY[operator](left, right, dialect)
