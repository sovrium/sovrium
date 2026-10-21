/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Make expression tokenizer (IML, as a blueprint `mapper` stores it).
 *
 * A mapped value holds `{{ … }}` parts, each one IML expression:
 *
 * - `1.email` reads module 1's output; `3.items[1].name` reads the first
 *   item (IML counts from 1, Sovrium from 0); a key with spaces is written in
 *   backticks, `` 1.`Company Name` ``;
 * - `formatDate(now; "YYYY-MM-DD")` calls a function, its arguments separated
 *   by `;`; `now` is the current instant;
 * - `"text"`, `42`, `true` and `false` are constants.
 *
 * Anything else — an operator (`1.a + 1`, `1.a = "x"`), a variable, an
 * unbalanced call — makes the whole part an `unsupported` token. Whether a
 * function translates is the mapper's decision, through Make's function
 * registry; the tokenizer only reads.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import type { CanonicalExpression, CanonicalExpressionToken } from './canonical-flow'

/** A token read from `text`, and where reading stopped. */
interface Parsed {
  readonly token: CanonicalExpressionToken
  readonly at: number
}

interface Reader {
  readonly text: string
  /** The trigger module's id: a reference to it reads the trigger's data. */
  readonly trigger: string | undefined
}

const skipSpaces = (text: string, at: number): number => {
  const match = /^\s*/.exec(text.slice(at))
  return at + (match?.[0].length ?? 0)
}

/** One path segment after a module id: `.key`, ``.`key with spaces` `` or `[n]`. */
const SEGMENT = /^(?:\.`([^`]+)`|\.([^\s.[\]();"`]+)|\[(\d+)\])/

const segmentsFrom = (
  text: string,
  at: number
): { readonly path: readonly string[]; readonly at: number } => {
  const match = SEGMENT.exec(text.slice(at))
  if (match === null) return { path: [], at }
  const index = match[3]
  const position = Number(index) - 1
  const segment =
    index === undefined ? (match[1] ?? match[2] ?? '') : position < 0 ? '' : String(position)
  const rest = segmentsFrom(text, at + match[0].length)
  return { path: [segment, ...rest.path], at: rest.at }
}

const readReference = (reader: Reader, at: number): Parsed | undefined => {
  const id = /^\d+/.exec(reader.text.slice(at))?.[0]
  if (id === undefined) return undefined
  const { path, at: end } = segmentsFrom(reader.text, at + id.length)
  if (path.length === 0) return { token: { kind: 'literal', value: Number(id) }, at: end }
  const token: CanonicalExpressionToken =
    id === reader.trigger
      ? { kind: 'ref', root: 'trigger', path }
      : { kind: 'ref', root: 'step', step: id, path }
  return { token, at: end }
}

const readString = (reader: Reader, at: number): Parsed | undefined => {
  const match = /^"([^"]*)"/.exec(reader.text.slice(at))
  return match === null
    ? undefined
    : { token: { kind: 'literal', value: match[1] ?? '' }, at: at + match[0].length }
}

/** The arguments of a call from just after `(`, up to and including `)`. */
const readArguments = (
  reader: Reader,
  at: number,
  args: readonly CanonicalExpressionToken[]
): { readonly args: readonly CanonicalExpressionToken[]; readonly at: number } | undefined => {
  const start = skipSpaces(reader.text, at)
  if (args.length === 0 && reader.text.charAt(start) === ')') return { args, at: start + 1 }
  const arg = readExpression(reader, start)
  if (arg === undefined) return undefined
  const next = skipSpaces(reader.text, arg.at)
  const char = reader.text.charAt(next)
  if (char === ')') return { args: [...args, arg.token], at: next + 1 }
  return char === ';' ? readArguments(reader, next + 1, [...args, arg.token]) : undefined
}

const readName = (reader: Reader, at: number): Parsed | undefined => {
  const name = /^[A-Za-z_][\w]*/.exec(reader.text.slice(at))?.[0]
  if (name === undefined) return undefined
  const end = at + name.length
  if (reader.text.charAt(end) === '(') {
    const call = readArguments(reader, end + 1, [])
    if (call === undefined) return undefined
    const source = reader.text.slice(at, call.at)
    return { token: { kind: 'call', name, args: call.args, source }, at: call.at }
  }
  if (name === 'true' || name === 'false') {
    return { token: { kind: 'literal', value: name === 'true' }, at: end }
  }
  return name === 'now'
    ? { token: { kind: 'call', name, args: [], source: name }, at: end }
    : undefined
}

/** One IML expression from `at`, or `undefined` when it is not one the tokenizer reads. */
function readExpression(reader: Reader, at: number): Parsed | undefined {
  const start = skipSpaces(reader.text, at)
  return readReference(reader, start) ?? readString(reader, start) ?? readName(reader, start)
}

/** The token one `{{ … }}` part becomes. */
const tokenOf = (part: string, trigger: string | undefined): CanonicalExpressionToken => {
  const reader: Reader = { text: part.slice(2, -2), trigger }
  const parsed = readExpression(reader, 0)
  const whole = parsed !== undefined && skipSpaces(reader.text, parsed.at) === reader.text.length
  if (!whole || (parsed.token.kind === 'literal' && typeof parsed.token.value === 'number')) {
    return { kind: 'unsupported', source: part }
  }
  return parsed.token.kind === 'call' ? { ...parsed.token, source: part } : parsed.token
}

/**
 * One Make mapper value: a string holding `{{ … }}` tokenised, or the value
 * unchanged. Objects and arrays are walked.
 *
 * @param trigger - the id of the module that starts the scenario.
 */
export const tokeniseMakeValue = (value: unknown, trigger: string | undefined): unknown => {
  if (Array.isArray(value)) return value.map((item) => tokeniseMakeValue(item, trigger))
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, tokeniseMakeValue(item, trigger)])
    )
  }
  if (typeof value !== 'string' || !value.includes('{{')) return value
  const tokens = value
    .split(/(\{\{[\s\S]*?\}\})/)
    .filter((part) => part !== '')
    .map((part): CanonicalExpressionToken =>
      part.startsWith('{{') ? tokenOf(part, trigger) : { kind: 'text', value: part }
    )
  return { kind: 'expression', source: value, tokens } satisfies CanonicalExpression
}
