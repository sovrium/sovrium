/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The formula lexer: source text in, a token list out, for either dialect.
 *
 * The two dialects share numbers, identifiers, punctuation and quoted strings.
 * They differ in how a field is named:
 *
 * - Airtable writes `{Field Name}`, or `{fldXXXXXXXXXXXXXX}` when its API
 *   returns the formula, and a bare word is a field name only when it has no
 *   spaces (`Price * 2`).
 * - Notion writes `prop("Field Name")`, and its API falls back to a
 *   `{{notion:block_property:<id>:...}}` reference when it cannot.
 *
 * Both become a `field` token carrying the key the source used. Whitespace is
 * dropped; a character no rule reads ends the lex with an error naming it.
 */

import type { FormulaDialect } from './formula-ast'

/** One token. `text` is the source spelling; `value` the decoded literal. */
export type FormulaToken =
  | { readonly kind: 'number'; readonly text: string; readonly value: number }
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'field'; readonly ref: string }
  | { readonly kind: 'identifier'; readonly text: string }
  | { readonly kind: 'operator'; readonly text: string }
  | { readonly kind: 'punctuation'; readonly text: '(' | ')' | ',' | '[' | ']' | '.' | '?' | ':' }
  | { readonly kind: 'end' }

/** A lex: the tokens, or the reason it stopped. */
export type FormulaLex =
  | { readonly ok: true; readonly tokens: readonly FormulaToken[] }
  | { readonly ok: false; readonly reason: string }

/** Multi-character operators first, so `<=` is never read as `<` then `=`. */
const OPERATORS = [
  '==',
  '!=',
  '<>',
  '<=',
  '>=',
  '&&',
  '||',
  '+',
  '-',
  '*',
  '/',
  '%',
  '^',
  '&',
  '=',
  '<',
  '>',
  '!',
]

const PUNCTUATION = new Set(['(', ')', ',', '[', ']', '.', '?', ':'])

const NOTION_BLOCK_PROPERTY = /^\{\{notion:block_property:([^:}]+)(?::[^}]*)?\}\}/

const NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*/

const ESCAPES: Readonly<Record<string, string>> = { n: '\n', t: '\t', r: '\r' }

const DOUBLE_QUOTED = /^"((?:[^"\\]|\\[\s\S])*)"/
const SINGLE_QUOTED = /^'((?:[^'\\]|\\[\s\S])*)'/

/** Read a quoted string starting at `start`; backslash escapes the next character. */
const readString = (
  source: string,
  start: number
): { readonly value: string; readonly end: number } | undefined => {
  const rest = source.slice(start)
  const match = (rest.startsWith('"') ? DOUBLE_QUOTED : SINGLE_QUOTED).exec(rest)
  if (match === null) return undefined
  const value = (match[1] ?? '').replace(/\\([\s\S])/g, (_, next: string) => ESCAPES[next] ?? next)
  return { value, end: start + match[0].length }
}

interface Step {
  readonly token: FormulaToken
  readonly end: number
}

/** A `{...}` reference: Airtable's field braces, or Notion's block-property fallback. */
const readBrace = (dialect: FormulaDialect, rest: string, at: number): Step | undefined => {
  const notion = NOTION_BLOCK_PROPERTY.exec(rest)
  if (notion !== null && dialect === 'notion') {
    return { token: { kind: 'field', ref: notion[1] ?? '' }, end: at + notion[0].length }
  }
  if (dialect !== 'airtable') return undefined
  const close = rest.indexOf('}')
  return close < 1
    ? undefined
    : { token: { kind: 'field', ref: rest.slice(1, close) }, end: at + close + 1 }
}

/** One token at `at`, or `undefined` when no rule reads the character there. */
const readToken = (dialect: FormulaDialect, source: string, at: number): Step | undefined => {
  const rest = source.slice(at)
  const char = rest[0] ?? ''
  if (char === '"' || char === "'") {
    const read = readString(source, at)
    return read === undefined
      ? undefined
      : { token: { kind: 'string', value: read.value }, end: read.end }
  }
  if (char === '{') return readBrace(dialect, rest, at)
  const number = NUMBER.exec(rest)
  if (number !== null) {
    const text = number[0]
    return { token: { kind: 'number', text, value: Number(text) }, end: at + text.length }
  }
  const identifier = IDENTIFIER.exec(rest)
  if (identifier !== null) {
    const text = identifier[0]
    return { token: { kind: 'identifier', text }, end: at + text.length }
  }
  const operator = OPERATORS.find((candidate) => rest.startsWith(candidate))
  if (operator !== undefined) {
    return { token: { kind: 'operator', text: operator }, end: at + operator.length }
  }
  return PUNCTUATION.has(char)
    ? {
        token: { kind: 'punctuation', text: char as '(' | ')' | ',' | '[' | ']' | '.' | '?' | ':' },
        end: at + 1,
      }
    : undefined
}

const WHITESPACE = /^\s+/

/** The index of the first non-blank character at or after `at`. */
const skipBlank = (source: string, at: number): number =>
  at + (WHITESPACE.exec(source.slice(at))?.[0].length ?? 0)

/**
 * Lex one formula.
 *
 * Deterministic and total: every input yields either the full token list,
 * ending in an `end` token, or the reason it stopped.
 */
export const lexFormula = (dialect: FormulaDialect, source: string): FormulaLex => {
  const lex = (at: number, tokens: readonly FormulaToken[]): FormulaLex => {
    const start = skipBlank(source, at)
    if (start >= source.length) return { ok: true, tokens: [...tokens, { kind: 'end' }] }
    const step = readToken(dialect, source, start)
    if (step === undefined) {
      return {
        ok: false,
        reason: `Unreadable formula text at character ${start + 1}: "${source.slice(start, start + 12)}"`,
      }
    }
    return lex(step.end, [...tokens, step.token])
  }
  return lex(0, [])
}
