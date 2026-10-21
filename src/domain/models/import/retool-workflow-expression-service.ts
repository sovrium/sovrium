/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Retool Workflows expressions, read without evaluating them.
 *
 * A Retool block reads earlier blocks through JavaScript: `{{ lookup.data.id }}`
 * inside a query or a request, and a plain JavaScript statement in a Branch
 * condition (`score.data.seats >= 50`). Only two shapes are read:
 *
 * - a REFERENCE, `<block>.data` followed by keys or indexes; the start block's
 *   data is the trigger's, any other block's is that step's result;
 * - in a Branch statement, a COMPARISON of a reference with a constant or a
 *   reference (`===`, `==`, `!==`, `!=`, `>`, `>=`, `<`, `<=`), or several
 *   joined by `&&` alone or `||` alone.
 *
 * Anything else — a method call, arithmetic, a ternary, an empty statement —
 * is kept verbatim as an `unsupported` token, and the step or the rule holding
 * it is a TODO quoting it.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import type {
  CanonicalCondition,
  CanonicalExpression,
  CanonicalExpressionToken,
} from './canonical-flow'

/** What reading a Retool expression needs besides its text. */
export interface RetoolScope {
  /** The start block's name: a reference to it reads the trigger's data. */
  readonly trigger: string | undefined
}

const IDENTIFIER = String.raw`[A-Za-z_$][\w$]*`
const SEGMENT = String.raw`(?:\.${IDENTIFIER}|\[\d+\]|\["[^"\]]*"\]|\['[^'\]]*'\])`
const REFERENCE = new RegExp(String.raw`^(${IDENTIFIER})\.data(${SEGMENT}*)$`)

/** The keys of a path written after `.data`. */
const keysOf = (path: string): readonly string[] =>
  [...path.matchAll(new RegExp(SEGMENT, 'g'))].map(([segment]) =>
    segment.startsWith('.') ? segment.slice(1) : segment.slice(1, -1).replace(/^["']|["']$/g, '')
  )

/** A reference token, or `undefined` when the text is not one. */
export const readRetoolReference = (
  text: string,
  scope: RetoolScope
): CanonicalExpressionToken | undefined => {
  const match = REFERENCE.exec(text.trim())
  const block = match?.[1]
  if (block === undefined) return undefined
  const path = keysOf(match?.[2] ?? '')
  return block === scope.trigger
    ? { kind: 'ref', root: 'trigger', path }
    : { kind: 'ref', root: 'step', step: block, path }
}

const tokenOf = (part: string, scope: RetoolScope): CanonicalExpressionToken =>
  readRetoolReference(part.slice(2, -2), scope) ?? { kind: 'unsupported', source: part }

/**
 * One Retool value: a string holding `{{ … }}` parts tokenised, or the value
 * unchanged. Objects and arrays are walked.
 */
export const tokeniseRetoolValue = (value: unknown, scope: RetoolScope): unknown => {
  if (Array.isArray(value)) return value.map((item) => tokeniseRetoolValue(item, scope))
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, tokeniseRetoolValue(item, scope)])
    )
  }
  if (typeof value !== 'string' || !value.includes('{{')) return value
  const tokens = value
    .split(/(\{\{[\s\S]*?\}\})/)
    .filter((part) => part !== '')
    .map((part): CanonicalExpressionToken =>
      part.startsWith('{{') ? tokenOf(part, scope) : { kind: 'text', value: part }
    )
  return { kind: 'expression', source: value, tokens } satisfies CanonicalExpression
}

const expression = (source: string, token: CanonicalExpressionToken): CanonicalExpression => ({
  kind: 'expression',
  source,
  tokens: [token],
})

/** A constant operand: a number, a quoted string, `true` or `false`. */
const constantOf = (text: string): string | number | boolean | undefined => {
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text)
  if (text === 'true' || text === 'false') return text === 'true'
  const quoted = /^(["'])(.*)\1$/.exec(text)
  return quoted?.[2] !== undefined && !quoted[2].includes(quoted[1] ?? '') ? quoted[2] : undefined
}

const COMPARISON = /^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/

type Rule = CanonicalCondition['rules'][number]

/** One comparison as a rule, or `undefined` when it is not one the reader reads. */
const ruleOf = (text: string, scope: RetoolScope): Rule | undefined => {
  const match = COMPARISON.exec(text.trim())
  const [, leftText = '', operator = '', rightText = ''] = match ?? []
  const left = readRetoolReference(leftText, scope)
  if (match === null || left === undefined) return undefined
  const constant = constantOf(rightText.trim())
  const reference = readRetoolReference(rightText, scope)
  const right =
    constant !== undefined
      ? constant
      : reference === undefined
        ? undefined
        : expression(rightText.trim(), reference)
  return right === undefined
    ? undefined
    : { left: expression(leftText.trim(), left), operator, right }
}

/** A statement the reader does not read: one rule quoting it, which no operator row maps. */
const verbatim = (statement: string): CanonicalCondition => ({
  combinator: 'and',
  rules: [
    {
      left: expression(statement, { kind: 'unsupported', source: statement }),
      operator: 'javascript',
    },
  ],
})

/**
 * A Branch statement as a condition. A statement the reader does not read is
 * one rule quoting it, which the mapper reports as a TODO.
 */
export const retoolCondition = (statement: string, scope: RetoolScope): CanonicalCondition => {
  const text = /^\{\{([\s\S]*)\}\}$/.exec(statement.trim())?.[1] ?? statement
  const hasAnd = text.includes('&&')
  const hasOr = text.includes('||')
  if (hasAnd && hasOr) return verbatim(statement)
  const parts = text.split(hasOr ? '||' : '&&')
  const rules = parts.map((part) => ruleOf(part, scope))
  return text.trim() === '' || rules.some((rule) => rule === undefined)
    ? verbatim(statement)
    : { combinator: hasOr ? 'or' : 'and', rules: rules.filter((rule) => rule !== undefined) }
}
