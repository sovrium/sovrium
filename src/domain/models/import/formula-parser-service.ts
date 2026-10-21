/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The formula parser: one Pratt parser, two operator tables.
 *
 * ## Airtable
 *
 * Spreadsheet precedence, as Airtable documents it: comparison binds loosest,
 * then `&`, then `+ -`, then `* /`, then a leading `-`. `AND`, `OR` and `NOT`
 * are functions, not operators. A bare word is a field when it is not
 * followed by `(` and is not `TRUE`/`FALSE`.
 *
 * ## Notion
 *
 * Notion's formula language (2.0), as its API `expression` spells it: the
 * JavaScript-like operators (`? :`, `or`/`||`, `and`/`&&`, `==`, `!=`, the
 * comparisons, `+ -`, `* / %`, a right-associative `^`, a leading `not`/`!`
 * or `-`), `prop("Name")` for a field, list literals, and method calls:
 * `x.lower()` parses as `LOWER(x)`. `let(name, value, body)` and
 * `lets(a, 1, b, 2, body)` are expanded here, by substituting each bound name
 * in the body, so no later stage needs scopes.
 */

import { mapFormulaChildren } from './formula-ast'
import { lexFormula, type FormulaToken } from './formula-lexer-service'
import type {
  FormulaBinaryOperator,
  FormulaDialect,
  FormulaNode,
  FormulaParse,
} from './formula-ast'

interface Infix {
  readonly power: number
  readonly operator: FormulaBinaryOperator
  readonly rightAssociative?: boolean
}

const AIRTABLE_INFIX: Readonly<Record<string, Infix>> = {
  '=': { power: 10, operator: '=' },
  '!=': { power: 10, operator: '!=' },
  '<>': { power: 10, operator: '!=' },
  '<': { power: 10, operator: '<' },
  '<=': { power: 10, operator: '<=' },
  '>': { power: 10, operator: '>' },
  '>=': { power: 10, operator: '>=' },
  '&': { power: 20, operator: '&' },
  '+': { power: 30, operator: '+' },
  '-': { power: 30, operator: '-' },
  '*': { power: 40, operator: '*' },
  '/': { power: 40, operator: '/' },
}

const NOTION_INFIX: Readonly<Record<string, Infix>> = {
  or: { power: 10, operator: 'or' },
  '||': { power: 10, operator: 'or' },
  and: { power: 20, operator: 'and' },
  '&&': { power: 20, operator: 'and' },
  '==': { power: 30, operator: '=' },
  '!=': { power: 30, operator: '!=' },
  '<': { power: 35, operator: '<' },
  '<=': { power: 35, operator: '<=' },
  '>': { power: 35, operator: '>' },
  '>=': { power: 35, operator: '>=' },
  '+': { power: 40, operator: '+' },
  '-': { power: 40, operator: '-' },
  '*': { power: 50, operator: '*' },
  '/': { power: 50, operator: '/' },
  '%': { power: 50, operator: '%' },
  '^': { power: 60, operator: '^', rightAssociative: true },
}

/** How tightly a leading operator binds its operand. */
const PREFIX_POWER: Readonly<Record<FormulaDialect, number>> = { airtable: 50, notion: 55 }

/** The ternary `? :` binds loosest of all. */
const TERNARY_POWER = 5

/** A method call `.name()` binds tightest. */
const POSTFIX_POWER = 70

/** A parse failure, thrown inside the parser and caught once at its boundary. */
class ParseFailure {
  constructor(readonly reason: string) {}
}

const fail = (reason: string): never => {
  // eslint-disable-next-line functional/no-throw-statements -- the parser unwinds on its first error; parseFormula catches it once and returns a value, so nothing outside this module ever sees a throw
  throw new ParseFailure(reason)
}

const describe = (token: FormulaToken): string => {
  switch (token.kind) {
    case 'end':
      return 'the end of the formula'
    case 'number':
    case 'identifier':
    case 'operator':
    case 'punctuation':
      return `"${token.text}"`
    case 'string':
      return 'a string'
    case 'field':
      return 'a field reference'
  }
}

/** Replace each bound name in `node` with its value. */
const substitute = (node: FormulaNode, bindings: ReadonlyMap<string, FormulaNode>): FormulaNode =>
  node.kind === 'identifier'
    ? (bindings.get(node.name) ?? node)
    : mapFormulaChildren(node, (child) => substitute(child, bindings))

/** Expand `let(name, value, body)` and `lets(a, 1, b, 2, body)`; each value sees earlier names. */
const expandLet = (args: readonly FormulaNode[]): FormulaNode => {
  const body = args.at(-1)
  const pairs = args.slice(0, -1)
  if (body === undefined || pairs.length === 0 || pairs.length % 2 !== 0) {
    return fail('let and lets take name/value pairs followed by one expression')
  }
  const bindings = pairs.reduce<ReadonlyMap<string, FormulaNode>>((bound, node, index) => {
    if (index % 2 === 1) return bound
    if (node.kind !== 'identifier') return fail('a let binding must be a plain name')
    const value = pairs[index + 1]
    return value === undefined ? bound : new Map([...bound, [node.name, substitute(value, bound)]])
  }, new Map())
  return substitute(body, bindings)
}

/** A cursor over the token list; each read returns the next cursor. */
interface Cursor {
  readonly tokens: readonly FormulaToken[]
  readonly at: number
}

const peek = (cursor: Cursor): FormulaToken => cursor.tokens[cursor.at] ?? { kind: 'end' }
const advance = (cursor: Cursor): Cursor => ({ ...cursor, at: cursor.at + 1 })
const isPunctuation = (token: FormulaToken, text: string): boolean =>
  token.kind === 'punctuation' && token.text === text

const expect = (cursor: Cursor, text: string): Cursor =>
  isPunctuation(peek(cursor), text)
    ? advance(cursor)
    : fail(`Expected "${text}" but found ${describe(peek(cursor))}`)

interface Parsed {
  readonly node: FormulaNode
  readonly cursor: Cursor
}

interface ParsedList {
  readonly items: readonly FormulaNode[]
  readonly cursor: Cursor
}

/** The parser for one dialect. */
const parserFor = (dialect: FormulaDialect) => {
  const infixTable = dialect === 'airtable' ? AIRTABLE_INFIX : NOTION_INFIX

  /** A comma-separated list up to `close`, the opening token already read. */
  const parseList = (cursor: Cursor, close: string): ParsedList => {
    if (isPunctuation(peek(cursor), close)) return { items: [], cursor: advance(cursor) }
    const step = (from: Cursor, items: readonly FormulaNode[]): ParsedList => {
      const parsed = parseExpression(from, 0)
      const next = peek(parsed.cursor)
      const all = [...items, parsed.node]
      if (isPunctuation(next, ',')) return step(advance(parsed.cursor), all)
      return { items: all, cursor: expect(parsed.cursor, close) }
    }
    return step(cursor, [])
  }

  const call = (name: string, args: readonly FormulaNode[]): FormulaNode => {
    const upper = name.toUpperCase()
    if (dialect === 'notion' && upper === 'PROP') {
      const [key] = args
      return args.length === 1 && key?.kind === 'string'
        ? { kind: 'field', ref: key.value }
        : fail('prop() takes the property name as one string')
    }
    if (dialect === 'notion' && (upper === 'LET' || upper === 'LETS')) return expandLet(args)
    return { kind: 'call', name: upper, args }
  }

  const parseIdentifier = (text: string, cursor: Cursor): Parsed => {
    if (isPunctuation(peek(cursor), '(')) {
      const list = parseList(advance(cursor), ')')
      return { node: call(text, list.items), cursor: list.cursor }
    }
    const lower = text.toLowerCase()
    if (lower === 'true' || lower === 'false') {
      return { node: { kind: 'boolean', value: lower === 'true' }, cursor }
    }
    return dialect === 'airtable'
      ? { node: { kind: 'field', ref: text }, cursor }
      : { node: { kind: 'identifier', name: text }, cursor }
  }

  const parseOperatorPrefix = (text: string, cursor: Cursor): Parsed => {
    if (text === '-' || text === '+') return unary(text, cursor)
    if (text === '!' && dialect === 'notion') return unary('not', cursor)
    return fail(`Unexpected "${text}"`)
  }

  const parsePunctuationPrefix = (text: string, cursor: Cursor): Parsed => {
    if (text === '(') {
      const inner = parseExpression(cursor, 0)
      return { node: inner.node, cursor: expect(inner.cursor, ')') }
    }
    if (text === '[' && dialect === 'notion') {
      const list = parseList(cursor, ']')
      return { node: { kind: 'list', items: list.items }, cursor: list.cursor }
    }
    return fail(`Unexpected "${text}"`)
  }

  const parsePrefix = (cursor: Cursor): Parsed => {
    const token = peek(cursor)
    const next = advance(cursor)
    switch (token.kind) {
      case 'number':
        return { node: { kind: 'number', value: token.value, text: token.text }, cursor: next }
      case 'string':
        return { node: { kind: 'string', value: token.value }, cursor: next }
      case 'field':
        return { node: { kind: 'field', ref: token.ref }, cursor: next }
      case 'identifier':
        return dialect === 'notion' && token.text === 'not'
          ? unary('not', next)
          : parseIdentifier(token.text, next)
      case 'operator':
        return parseOperatorPrefix(token.text, next)
      case 'punctuation':
        return parsePunctuationPrefix(token.text, next)
      case 'end':
        return fail('The formula ends where a value was expected')
    }
  }

  const unary = (operator: '-' | '+' | 'not', cursor: Cursor): Parsed => {
    const operand = parseExpression(cursor, PREFIX_POWER[dialect])
    return { node: { kind: 'unary', operator, operand: operand.node }, cursor: operand.cursor }
  }

  const infixOf = (token: FormulaToken): Infix | undefined => {
    if (token.kind === 'operator') return infixTable[token.text]
    if (token.kind === 'identifier' && dialect === 'notion') return infixTable[token.text]
    return undefined
  }

  const parseMethod = (left: FormulaNode, cursor: Cursor): Parsed => {
    const name = peek(cursor)
    if (name.kind !== 'identifier') return fail('A method name must follow "."')
    const after = advance(cursor)
    const list: ParsedList = isPunctuation(peek(after), '(')
      ? parseList(advance(after), ')')
      : { items: [], cursor: after }
    return { node: call(name.text, [left, ...list.items]), cursor: list.cursor }
  }

  const parseTernary = (test: FormulaNode, cursor: Cursor): Parsed => {
    const then = parseExpression(cursor, 0)
    const otherwise = parseExpression(expect(then.cursor, ':'), TERNARY_POWER - 1)
    return {
      node: { kind: 'conditional', test, then: then.node, otherwise: otherwise.node },
      cursor: otherwise.cursor,
    }
  }

  const parseInfix = (left: FormulaNode, cursor: Cursor, infix: Infix): Parsed => {
    const right = parseExpression(
      cursor,
      infix.rightAssociative === true ? infix.power - 1 : infix.power
    )
    return {
      node: { kind: 'binary', operator: infix.operator, left, right: right.node },
      cursor: right.cursor,
    }
  }

  /** Extend `left` with one postfix or infix step, or return `undefined` when none binds. */
  const parseStep = (left: FormulaNode, cursor: Cursor, minPower: number): Parsed | undefined => {
    const token = peek(cursor)
    const notion = dialect === 'notion'
    if (notion && isPunctuation(token, '.') && POSTFIX_POWER > minPower) {
      return parseMethod(left, advance(cursor))
    }
    if (notion && isPunctuation(token, '?') && TERNARY_POWER > minPower) {
      return parseTernary(left, advance(cursor))
    }
    const infix = infixOf(token)
    return infix === undefined || infix.power <= minPower
      ? undefined
      : parseInfix(left, advance(cursor), infix)
  }

  const parseExpression = (cursor: Cursor, minPower: number): Parsed => {
    const climb = (parsed: Parsed): Parsed => {
      const step = parseStep(parsed.node, parsed.cursor, minPower)
      return step === undefined ? parsed : climb(step)
    }
    return climb(parsePrefix(cursor))
  }

  return parseExpression
}

/**
 * Parse one formula of a dialect into the shared AST.
 *
 * Deterministic: the same text always yields the same tree. Never throws; a
 * formula the grammar does not read is `{ ok: false, reason }`.
 */
export const parseFormula = (dialect: FormulaDialect, source: string): FormulaParse => {
  const lexed = lexFormula(dialect, source)
  if (!lexed.ok) return lexed
  try {
    const parsed = parserFor(dialect)({ tokens: lexed.tokens, at: 0 }, 0)
    const rest = peek(parsed.cursor)
    return rest.kind === 'end'
      ? { ok: true, node: parsed.node }
      : { ok: false, reason: `Unexpected ${describe(rest)} after a complete expression` }
  } catch (error) {
    if (error instanceof ParseFailure) return { ok: false, reason: error.reason }
    return { ok: false, reason: `The formula could not be parsed: ${String(error)}` }
  }
}
