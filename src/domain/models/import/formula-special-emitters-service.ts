/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The emitters a function table row names when a rename is not enough.
 *
 * Typed as a record over `SpecialEmitter`, so every name a table row can use
 * has exactly one emitter, and adding a name without its emitter does not
 * compile. Each receives the call's argument nodes, already checked against
 * the row's arity, and emits them through the context.
 */

import { DATE_EMITTERS } from './formula-date-emitters-service'
import { arithmetic, compare, logical, negation, plus } from './formula-emit-operators-service'
import {
  PRECEDENCE,
  atom,
  caseWhen,
  composed,
  concatAll,
  integerArgument,
  literalInteger,
  refuse,
  sqlNumber,
  typed,
  typedAll,
  wrap,
  type EmitContext,
  type Emitted,
} from './formula-emit-primitives-service'
import { SOURCE_EMITTERS } from './formula-source-emitters-service'
import type { FormulaNode } from './formula-ast'
import type { FormulaValueType, SpecialEmitter } from './formula-function-mappings'

type Special = (args: readonly FormulaNode[], context: EmitContext) => Emitted

const all = (args: readonly FormulaNode[], context: EmitContext): readonly Emitted[] =>
  args.map((arg) => context.emit(arg))

const first = (args: readonly FormulaNode[], context: EmitContext): Emitted =>
  context.emit(args[0] ?? { kind: 'boolean', value: false })

/** The first two arguments, emitted. */
const pair = (args: readonly FormulaNode[], context: EmitContext): readonly [Emitted, Emitted] => {
  const [left, right] = all(args, context)
  return left === undefined || right === undefined
    ? refuse('unsupported', 'A call is missing an argument')
    : [left, right]
}

/** The arguments a call cannot do without, emitted; refused when one is missing. */
const required = (
  what: string,
  count: number,
  args: readonly FormulaNode[],
  context: EmitContext
): readonly Emitted[] =>
  args.length < count
    ? refuse('unsupported', `${what} is missing an argument`)
    : all(args.slice(0, count), context)

/** Condition/value pairs from a flat `c1, v1, c2, v2` list. */
const pairsOf = (pieces: readonly Emitted[]): readonly (readonly [Emitted, Emitted])[] =>
  pieces.flatMap((piece, index) => {
    const value = pieces[index + 1]
    return index % 2 === 0 && value !== undefined ? [[piece, value] as const] : []
  })

/** `start + offset`, folded when the start is a literal. */
const shifted = (piece: Emitted, offset: number): Emitted => {
  const literal = literalInteger(piece)
  if (literal !== undefined) return sqlNumber(literal + offset)
  if (offset === 0) return piece
  return arithmetic(offset > 0 ? '+' : '-', piece, sqlNumber(Math.abs(offset)))
}

/**
 * A length as `SUBSTR` takes it: never negative, never blank. PostgreSQL
 * refuses to write a row whose formula asks for a negative length, and SQLite
 * reads a blank length as a blank result where PostgreSQL reads it as none.
 */
const nonNegative = (piece: Emitted): Emitted => {
  const literal = literalInteger(piece)
  if (literal !== undefined) return sqlNumber(Math.max(literal, 0))
  return call('GREATEST', 'number', [
    call('COALESCE', 'number', [piece, sqlNumber(0)]),
    sqlNumber(0),
  ])
}

const substr = (parts: readonly Emitted[]): Emitted =>
  composed(`SUBSTR(${parts.map((part) => part.sql).join(', ')})`, 'text', PRECEDENCE.atom, parts)

const call = (name: string, type: FormulaValueType, parts: readonly Emitted[]): Emitted =>
  composed(`${name}(${parts.map((part) => part.sql).join(', ')})`, type, PRECEDENCE.atom, parts)

/** `10^places` as a decimal literal, for rounding to a fixed number of places. */
const scale = (places: Emitted): string => {
  const value = literalInteger(places)
  if (value === undefined || Math.abs(value) > 12) {
    return refuse('degraded', 'Rounding to a computed number of places has no exact portable form')
  }
  return value >= 0 ? `1${'0'.repeat(value)}.0` : `0.${'0'.repeat(-value - 1)}1`
}

const ifEmitter: Special = (args, context) => {
  const [test, then, otherwise] = all(args, context)
  return test === undefined || then === undefined
    ? refuse('unsupported', 'IF needs a condition and a value')
    : caseWhen([[test, then]], otherwise)
}

const ifsEmitter: Special = (args, context) => {
  const pieces = all(args, context)
  return pieces.length % 2 === 0
    ? refuse('unsupported', 'ifs needs a final value for no match')
    : caseWhen(pairsOf(pieces.slice(0, -1)), pieces.at(-1))
}

const switchEmitter: Special = (args, context) => {
  const [subject, ...rest] = all(args, context)
  if (subject === undefined) return refuse('unsupported', 'SWITCH needs a value to match')
  const pairs = pairsOf(rest).map(
    ([pattern, value]) => [compare('=', subject, pattern), value] as const
  )
  return caseWhen(pairs, rest.length % 2 === 1 ? rest.at(-1) : undefined)
}

const emptyTests = (value: Emitted): Readonly<Partial<Record<FormulaValueType, string>>> => ({
  text: `COALESCE(${value.sql}, '') = ''`,
  number: `COALESCE(${value.sql}, 0) = 0`,
  boolean: `NOT COALESCE(${value.sql}, FALSE)`,
  date: `${wrap(value, PRECEDENCE.compare + 1)} IS NULL`,
  datetime: `${wrap(value, PRECEDENCE.compare + 1)} IS NULL`,
  null: 'TRUE',
})

const emptyEmitter: Special = (args, context) => {
  const value = first(args, context)
  const test = emptyTests(value)[value.type]
  return test === undefined
    ? refuse('unsupported', 'empty() reads a value whose type is not known')
    : composed(test, 'boolean', PRECEDENCE.compare, [value])
}

const containsEmitter: Special = (args, context) => {
  const [haystack, needle] = typedAll('contains()', 'text', pair(args, context))
  if (haystack === undefined || needle === undefined) return atom('FALSE', 'boolean')
  if (needle.emptyText === true) return atom('TRUE', 'boolean')
  const source = `COALESCE(${haystack.sql}, '')`
  const found = `REPLACE(${source}, ${needle.sql}, '') <> ${source}`
  return composed(
    needle.sql.startsWith("'") ? found : `(${found} OR ${needle.sql} = '')`,
    'boolean',
    PRECEDENCE.compare,
    [haystack, needle]
  )
}

const roundTo =
  (shape: 'up' | 'down'): Special =>
  (args, context) => {
    const [raw, places] = pair(args, context)
    const value = typed('Rounding', 'number', raw)
    const factor = scale(places)
    const sql =
      shape === 'up'
        ? `SIGN(${value.sql}) * CEIL(ABS(${value.sql}) * ${factor}) / ${factor}`
        : `TRUNC(${wrap(value, PRECEDENCE.multiply)} * ${factor}) / ${factor}`
    return composed(sql, 'number', PRECEDENCE.multiply, [value, places])
  }

const toSignificance =
  (name: 'CEIL' | 'FLOOR'): Special =>
  (args, context) => {
    const [value, significance] = typedAll(name, 'number', all(args, context))
    if (value === undefined) return refuse('unsupported', `${name} needs a number`)
    if (significance === undefined) return call(name, 'number', [value])
    const steps = arithmetic('/', value, significance)
    return composed(
      `${name}(${steps.sql}) * ${wrap(significance, PRECEDENCE.multiply + 1)}`,
      'number',
      PRECEDENCE.multiply,
      [steps, significance]
    )
  }

const arithmeticOf =
  (operator: '-' | '*' | '/' | '%' | '^'): Special =>
  (args, context) =>
    arithmetic(operator, ...pair(args, context))

const comparisonOf =
  (operator: '>' | '<' | '=' | '!='): Special =>
  (args, context) =>
    compare(operator, ...pair(args, context))

const leftEmitter: Special = (args, context) => {
  const [source, count] = pair(args, context)
  return substr([
    typed('LEFT', 'text', source),
    sqlNumber(1),
    nonNegative(integerArgument('LEFT', count)),
  ])
}

const rightEmitter: Special = (args, context) => {
  const [raw, count] = pair(args, context)
  const source = typed('RIGHT', 'text', raw)
  const length = call('LENGTH', 'number', [source])
  const start = arithmetic(
    '+',
    arithmetic('-', length, integerArgument('RIGHT', count)),
    sqlNumber(1)
  )
  return substr([source, call('GREATEST', 'number', [start, sqlNumber(1)])])
}

const midEmitter: Special = (args, context) => {
  const [source, start, count] = required('MID', 3, args, context)
  return substr([
    typed('MID', 'text', source ?? atom('NULL', 'null')),
    integerArgument('MID', start ?? sqlNumber(1)),
    nonNegative(integerArgument('MID', count ?? sqlNumber(0))),
  ])
}

const replaceAtEmitter: Special = (args, context) => {
  const [rawSource, start, count, replacement] = required('REPLACE', 4, args, context)
  const source = typed('REPLACE', 'text', rawSource ?? atom('NULL', 'null'))
  const from = integerArgument('REPLACE', start ?? sqlNumber(1))
  const head = substr([source, sqlNumber(1), nonNegative(shifted(from, -1))])
  const skipped = integerArgument('REPLACE', count ?? sqlNumber(0))
  const skippedValue = literalInteger(skipped)
  const tail = substr([
    source,
    skippedValue === undefined ? arithmetic('+', from, skipped) : shifted(from, skippedValue),
  ])
  return concatAll([head, typed('REPLACE', 'text', replacement ?? atom('NULL', 'null')), tail])
}

const substringEmitter: Special = (args, context) => {
  const [rawSource, start, end] = all(args, context)
  const source = typed('substring', 'text', rawSource ?? atom('NULL', 'null'))
  const from = integerArgument('substring', start ?? sqlNumber(0))
  if (end === undefined) return substr([source, shifted(from, 1)])
  const to = integerArgument('substring', end)
  const [toValue, fromValue] = [literalInteger(to), literalInteger(from)]
  const length =
    toValue !== undefined && fromValue !== undefined
      ? sqlNumber(Math.max(toValue - fromValue, 0))
      : nonNegative(arithmetic('-', to, from))
  return substr([source, shifted(from, 1), length])
}

const roundEmitter: Special = (args, context) => {
  const [value, places] = all(args, context)
  const number = typed('ROUND', 'number', value ?? atom('NULL', 'null'))
  return call('ROUND', 'number', [
    number,
    ...(places === undefined ? [] : [integerArgument('ROUND', places)]),
  ])
}

/**
 * The value when it is inside a function's domain, blank otherwise.
 *
 * PostgreSQL refuses to write a row whose formula takes the square root of a
 * negative number or the logarithm of zero; SQLite and both sources show an
 * empty cell. Guarding the argument makes both engines show an empty cell.
 */
const inDomain = (value: Emitted, test: '>= 0' | '> 0'): Emitted =>
  literalInteger(value) !== undefined && Number(value.sql) > 0
    ? value
    : composed(
        `CASE WHEN ${wrap(value, PRECEDENCE.compare + 1)} ${test} THEN ${value.sql} END`,
        'number',
        PRECEDENCE.atom,
        [value]
      )

const guarded =
  (name: 'SQRT' | 'LN' | 'LOG', test: '>= 0' | '> 0'): Special =>
  (args, context) =>
    call(name, 'number', [inDomain(typed(name, 'number', first(args, context)), test)])

const logEmitter: Special = (args, context) => {
  const [value, base] = typedAll('LOG', 'number', all(args, context))
  if (value === undefined) return refuse('unsupported', 'LOG needs a number')
  const argument = inDomain(value, '> 0')
  return call('LOG', 'number', base === undefined ? [argument] : [inDomain(base, '> 0'), argument])
}

const sumEmitter: Special = (args, context) => {
  const pieces = typedAll('SUM', 'number', all(args, context))
  if (pieces.length === 1 && pieces[0] !== undefined) return pieces[0]
  const terms = pieces.map((piece) =>
    literalInteger(piece) === undefined && !/^[\d.]+$/.test(piece.sql)
      ? call('COALESCE', 'number', [piece, sqlNumber(0)])
      : piece
  )
  return composed(terms.map((term) => term.sql).join(' + '), 'number', PRECEDENCE.add, terms)
}

const toTextEmitter: Special = (args, context) => {
  const value = first(args, context)
  if (value.type === 'text') return value
  const number = typed('format()', 'number', value)
  return composed(`CAST(${number.sql} AS TEXT)`, 'text', PRECEDENCE.atom, [number])
}

const toDateEmitter: Special = (args, context) => {
  const value = first(args, context)
  if (value.type !== 'date' && value.type !== 'datetime' && value.type !== 'null') {
    return refuse('degraded', 'DATESTR reads a date out of a value that is not one')
  }
  return composed(`CAST(${value.sql} AS DATE)`, 'date', PRECEDENCE.atom, [value])
}

const WRITE_TIME_NOTE = 'computed when the record is written, not every time it is read'

/** Every special emitter, by the name a table row uses. */
export const SPECIAL_EMITTERS: Readonly<Record<SpecialEmitter, Special>> = {
  if: ifEmitter,
  ifs: ifsEmitter,
  switch: switchEmitter,
  and: (args, context) => logical('and', all(args, context)),
  or: (args, context) => logical('or', all(args, context)),
  not: (args, context) => negation(first(args, context)),
  concat: (args, context) => concatAll(all(args, context)),
  blank: () => atom('NULL', 'null'),
  true: () => atom('TRUE', 'boolean'),
  false: () => atom('FALSE', 'boolean'),
  left: leftEmitter,
  right: rightEmitter,
  mid: midEmitter,
  replaceAt: replaceAtEmitter,
  substring: substringEmitter,
  contains: containsEmitter,
  empty: emptyEmitter,
  today: () => atom('CURRENT_DATE', 'date', [`The date is ${WRITE_TIME_NOTE}`]),
  now: () => atom('CURRENT_TIMESTAMP', 'datetime', [`The time is ${WRITE_TIME_NOTE}`]),
  createdTime: () => atom('created_at', 'datetime'),
  lastModifiedTime: () => atom('updated_at', 'datetime'),
  ceilingTo: toSignificance('CEIL'),
  floorTo: toSignificance('FLOOR'),
  round: roundEmitter,
  roundUp: roundTo('up'),
  roundDown: roundTo('down'),
  log: logEmitter,
  log2: (args, context) =>
    call('LOG', 'number', [
      sqlNumber(2),
      inDomain(typed('log2', 'number', first(args, context)), '> 0'),
    ]),
  log10: guarded('LOG', '> 0'),
  ln: guarded('LN', '> 0'),
  sqrt: guarded('SQRT', '>= 0'),
  sum: sumEmitter,
  isAfter: comparisonOf('>'),
  isBefore: comparisonOf('<'),
  isSame: comparisonOf('='),
  equal: comparisonOf('='),
  unequal: comparisonOf('!='),
  add: (args, context) => plus(...pair(args, context)),
  subtract: arithmeticOf('-'),
  multiply: arithmeticOf('*'),
  divide: arithmeticOf('/'),
  modulo: arithmeticOf('%'),
  power: arithmeticOf('^'),
  toText: toTextEmitter,
  toDate: toDateEmitter,
  pi: () => atom(String(Math.PI), 'number'),
  e: () => atom(String(Math.E), 'number'),
  ...DATE_EMITTERS,
  ...SOURCE_EMITTERS,
}
