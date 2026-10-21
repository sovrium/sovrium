/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The building blocks the formula emitter composes Sovrium formula text from.
 *
 * Every emitted piece carries its SQL text, the static type of its value, its
 * precedence (so a parent knows whether to parenthesise it) and the notes its
 * subtree collected. A construct that cannot be emitted on both engines ends
 * the emission with a refusal naming the outcome and the reason.
 *
 * ## The rules every piece keeps
 *
 * - Only words of the formula whitelist and field names appear in the text,
 *   because the formula validator reads every other word as a field.
 * - A negative value is always parenthesised (`(-1)`), because the validator
 *   refuses two operators in a row (`a * -1`).
 * - Each `||` operand is a call or a literal, because `||` binds tighter than
 *   `*` on SQLite and looser than `+` on PostgreSQL.
 */

import type { FormulaDialect, FormulaNode } from './formula-ast'
import type { FormulaValueType } from './formula-function-mappings'
import type { FieldType } from '@/domain/models/app/tables/fields/field'

/** A field a formula can reference: its Sovrium name and the type its values have. */
export interface FormulaFieldTarget {
  /** The Sovrium field name the reference becomes. */
  readonly name: string
  /** The field name the source showed, used to quote the original formula readably. */
  readonly label: string
  /** The static type of its values. */
  readonly type: FormulaValueType
  /**
   * Its Sovrium field type, when known. The date functions read only a plain
   * `date` or `datetime` field, whose stored text both engines agree on.
   */
  readonly fieldType?: FieldType
}

/** The fields a formula can reference, keyed by every key the source may use (id and name). */
export type FormulaFieldMap = ReadonlyMap<string, FormulaFieldTarget>

/** One emitted piece of formula text. */
export interface Emitted {
  readonly sql: string
  readonly type: FormulaValueType
  readonly precedence: number
  readonly notes: readonly string[]
  /** Set on the literal `''`, which a non-text branch reads as blank. */
  readonly emptyText?: boolean
}

/** What every emitter can reach: the dialect, the fields, and the emitter itself. */
export interface EmitContext {
  readonly dialect: FormulaDialect
  readonly fields: FormulaFieldMap
  readonly emit: (node: FormulaNode) => Emitted
}

/** Precedences, tightest first. */
export const PRECEDENCE = {
  atom: 100,
  multiply: 70,
  add: 60,
  concat: 55,
  compare: 40,
  not: 30,
  and: 20,
  or: 10,
} as const

/** Why a formula was not emitted. */
export class FormulaRefusal {
  constructor(
    readonly outcome: 'degraded' | 'unsupported',
    readonly reason: string
  ) {}
}

/** End the emission: the formula keeps its last values instead. */
export const refuse = (outcome: 'degraded' | 'unsupported', reason: string): never => {
  // eslint-disable-next-line functional/no-throw-statements -- the emitter unwinds on the first refusal; emitFormula catches it once and returns a value, so nothing outside the emitter ever sees a throw
  throw new FormulaRefusal(outcome, reason)
}

/** The notes of several pieces, each once, in order. */
export const notesOf = (...pieces: readonly Emitted[]): readonly string[] => [
  ...new Set(pieces.flatMap((piece) => piece.notes)),
]

/** An atom: a literal, a reference, a call, a CASE. */
export const atom = (
  sql: string,
  type: FormulaValueType,
  notes: readonly string[] = []
): Emitted => ({ sql, type, precedence: PRECEDENCE.atom, notes })

/** A piece built from children, with its own precedence. */
export const composed = (
  sql: string,
  type: FormulaValueType,
  precedence: number,
  children: readonly Emitted[]
): Emitted => ({ sql, type, precedence, notes: notesOf(...children) })

/** The piece with more notes. */
export const withNotes = (piece: Emitted, notes: readonly string[]): Emitted =>
  notes.length === 0 ? piece : { ...piece, notes: [...new Set([...piece.notes, ...notes])] }

/** The piece's text, parenthesised when it binds looser than `minimum`. */
export const wrap = (piece: Emitted, minimum: number): string =>
  piece.precedence < minimum ? `(${piece.sql})` : piece.sql

/** A text literal, quotes doubled. */
export const sqlString = (value: string): Emitted => ({
  ...atom(`'${value.replace(/'/g, "''")}'`, 'text'),
  ...(value === '' ? { emptyText: true } : {}),
})

/** A number literal, as plain decimal text. */
export const sqlNumber = (value: number): Emitted =>
  value < 0 ? atom(`(-${String(-value)})`, 'number') : atom(String(value), 'number')

const TYPE_WORDS: Readonly<Record<FormulaValueType, string>> = {
  number: 'a number',
  text: 'text',
  boolean: 'a true/false value',
  date: 'a date',
  datetime: 'a date and time',
  null: 'blank',
  unknown: 'a value of unknown type',
}

/** How a type reads in a refusal. */
export const describeType = (type: FormulaValueType): string => TYPE_WORDS[type]

/** The refusal outcome for a value of the wrong type: unknown is unsupported. */
const wrongTypeOutcome = (type: FormulaValueType): 'degraded' | 'unsupported' =>
  type === 'unknown' ? 'unsupported' : 'degraded'

/** The pieces, when every one is of `type` (or blank); refused otherwise. */
export const typedAll = (
  what: string,
  type: FormulaValueType,
  pieces: readonly Emitted[]
): readonly Emitted[] => {
  const wrong = pieces.find((piece) => piece.type !== type && piece.type !== 'null')
  return wrong === undefined
    ? pieces
    : refuse(
        wrongTypeOutcome(wrong.type),
        `${what} expects ${describeType(type)} but receives ${describeType(wrong.type)}`
      )
}

/** The piece, when it is of `type` (or blank); refused otherwise. */
export const typed = (what: string, type: FormulaValueType, piece: Emitted): Emitted =>
  typedAll(what, type, [piece])[0] ?? piece

const isFilled = (piece: Emitted): Emitted =>
  composed(`${wrap(piece, PRECEDENCE.compare + 1)} IS NOT NULL`, 'boolean', PRECEDENCE.compare, [
    piece,
  ])

const CONDITIONS: Readonly<Record<FormulaValueType, (piece: Emitted) => Emitted>> = {
  boolean: (piece) => piece,
  null: () => atom('FALSE', 'boolean'),
  number: (piece) =>
    composed(`COALESCE(${piece.sql}, 0) <> 0`, 'boolean', PRECEDENCE.compare, [piece]),
  text: (piece) =>
    composed(`COALESCE(${piece.sql}, '') <> ''`, 'boolean', PRECEDENCE.compare, [piece]),
  date: isFilled,
  datetime: isFilled,
  unknown: () => refuse('unsupported', 'A condition reads a value whose type is not known'),
}

/** A condition: a true/false value as itself, any other value by whether it is filled. */
export const truthy = (piece: Emitted): Emitted => CONDITIONS[piece.type](piece)

const NUMBER_AS_TEXT_NOTE =
  'A number joined into text is written the way the database prints it, which can keep trailing zeros'

const textOperand = (piece: Emitted): Emitted => {
  if (piece.precedence === PRECEDENCE.concat) return piece
  return piece.precedence === PRECEDENCE.atom && piece.sql.startsWith("'")
    ? piece
    : composed(`COALESCE(${piece.sql}, '')`, 'text', PRECEDENCE.atom, [piece])
}

/** One operand of a text join: never blank, always a call, a literal or a join. */
export const concatOperand = (piece: Emitted): Emitted => {
  if (piece.type === 'null') return sqlString('')
  if (piece.type === 'text') return textOperand(piece)
  if (piece.type === 'number') {
    return withNotes(
      composed(`COALESCE(CAST(${piece.sql} AS TEXT), '')`, 'text', PRECEDENCE.atom, [piece]),
      [NUMBER_AS_TEXT_NOTE]
    )
  }
  return piece.type === 'unknown'
    ? refuse('unsupported', 'Text is joined with a value whose type is not known')
    : refuse(
        'degraded',
        `Joining ${describeType(piece.type)} into text prints it differently on SQLite and PostgreSQL`
      )
}

/** Join pieces as text with `||`. */
export const concatAll = (pieces: readonly Emitted[]): Emitted => {
  const operands = pieces.map(concatOperand)
  return operands.length === 1 && operands[0] !== undefined
    ? operands[0]
    : composed(
        operands.map((operand) => operand.sql).join(' || '),
        'text',
        PRECEDENCE.concat,
        operands
      )
}

const INTEGER_LITERAL = /^\(?-?\d+\)?$/

/** An integer literal's value, when the piece is one. */
export const literalInteger = (piece: Emitted): number | undefined =>
  INTEGER_LITERAL.test(piece.sql) ? Number(piece.sql.replace(/[()]/g, '')) : undefined

/**
 * An integer argument: an integer literal as itself, any other number floored
 * then cast. PostgreSQL's cast rounds and SQLite's truncates, so the floor
 * makes both engines agree.
 */
export const integerArgument = (what: string, piece: Emitted): Emitted => {
  const number = typed(what, 'number', piece)
  return literalInteger(number) === undefined
    ? composed(`CAST(FLOOR(${number.sql}) AS INTEGER)`, 'number', PRECEDENCE.atom, [number])
    : number
}

/** The one type several branches share, `''` and blank aside; refused when they differ. */
export const branchType = (branches: readonly Emitted[]): FormulaValueType => {
  const solid = branches.filter((branch) => branch.type !== 'null')
  const nonText = solid.some((branch) => branch.type !== 'text')
  const counted = nonText ? solid.filter((branch) => branch.emptyText !== true) : solid
  const types = [...new Set(counted.map((branch) => branch.type))]
  if (types.length === 0) return solid.length > 0 ? 'text' : 'null'
  if (types.length === 1) return types[0] ?? 'null'
  // A date and a date and time do not merge: PostgreSQL would convert the date
  // through the server's time zone, and refuses such a column as a generated one.
  return refuse(
    'degraded',
    `The branches return different kinds of value (${types.map(describeType).join(' and ')})`
  )
}

/** A branch as the shared type: `''` becomes blank in a non-text result. */
const asBranch = (branch: Emitted, type: FormulaValueType): string =>
  branch.emptyText === true && type !== 'text' ? 'NULL' : branch.sql

/** `CASE WHEN … THEN … [ELSE …] END` over condition/value pairs. */
export const caseWhen = (
  pairs: readonly (readonly [Emitted, Emitted])[],
  otherwise: Emitted | undefined
): Emitted => {
  const values = [
    ...pairs.map(([, value]) => value),
    ...(otherwise === undefined ? [] : [otherwise]),
  ]
  const type = branchType(values)
  const conditions = pairs.map(([condition]) => truthy(condition))
  const whens = pairs.map(
    ([, value], index) => `WHEN ${conditions[index]?.sql ?? 'FALSE'} THEN ${asBranch(value, type)}`
  )
  const tail = otherwise === undefined ? '' : ` ELSE ${asBranch(otherwise, type)}`
  return composed(`CASE ${whens.join(' ')}${tail} END`, type, PRECEDENCE.atom, [
    ...conditions,
    ...values,
  ])
}
