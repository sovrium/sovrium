/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pieces of control flow a migrated step needs: a source condition as a
 * Sovrium condition group, a source pause as a `delay/wait` duration, and the
 * no-op that keeps a path valid when the source's path does nothing.
 *
 * A condition is translated rule by rule through the source's comparison
 * registry. A rule with no row is never approximated: it is returned as a
 * problem, quoted, for the caller to report.
 */

import { quoteOriginal } from './credential-redaction-service'
import { CONDITION_OPERATORS, UNARY_OPERATORS } from './flow-expression-mappings'
import { isExpression, renderText, type RenderContext } from './flow-expression-service'
import type { CanonicalCondition } from './canonical-flow'
import type { ConfigEntry } from './table-mapper-service'

/** A source condition translated: the group, when any rule translated, and the rules that did not. */
export interface TranslatedCondition {
  readonly group?: ConfigEntry
  readonly problems: readonly string[]
}

type Rule = CanonicalCondition['rules'][number]

const isScalar = (value: unknown): value is string | number | boolean | null =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value)

/** One rule as a Sovrium condition, or `undefined` when it does not translate. */
const conditionOf = (rule: Rule, context: RenderContext): ConfigEntry | undefined => {
  const operator = CONDITION_OPERATORS[context.tool][rule.operator]
  if (operator === undefined) return undefined
  const field = renderText(rule.left, context)
  if (UNARY_OPERATORS.has(operator)) return { field, operator }
  if (rule.right === undefined) return undefined
  if (isExpression(rule.right)) {
    return { field, operator, value: renderText(rule.right, context) }
  }
  return isScalar(rule.right) ? { field, operator, value: rule.right } : undefined
}

/** A source condition as a Sovrium condition group. */
export const translateCondition = (
  condition: CanonicalCondition,
  context: RenderContext
): TranslatedCondition => {
  const translated = condition.rules.map((rule) => ({
    rule,
    condition: conditionOf(rule, context),
  }))
  const conditions = translated.flatMap((one) =>
    one.condition === undefined ? [] : [one.condition]
  )
  const problems = translated.flatMap((one) =>
    one.condition === undefined ? [quoteOriginal(one.rule)] : []
  )
  return conditions.length === 0
    ? { problems }
    : { group: { logic: condition.combinator, conditions }, problems }
}

/** Seconds per Sovrium duration unit, largest first. */
const UNITS: readonly (readonly [string, number])[] = [
  ['d', 86_400],
  ['h', 3600],
  ['m', 60],
  ['s', 1],
]

const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/

/**
 * An ISO 8601 duration (`PT15M`, `P1D`, `PT1H30M`) as a Sovrium duration
 * (`15m`, `1d`, `90m`): the largest unit that divides it exactly. A duration
 * in months or years, or of zero, has no exact equivalent.
 */
export const toSovriumDuration = (iso: string): string | undefined => {
  const match = ISO_DURATION.exec(iso)
  if (match === null) return undefined
  const [days, hours, minutes, seconds] = [match[1], match[2], match[3], match[4]].map((part) =>
    Number(part ?? 0)
  )
  const total = (days ?? 0) * 86_400 + (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0)
  const unit = UNITS.find(([, size]) => total % size === 0)
  return total === 0 || unit === undefined ? undefined : `${String(total / unit[1])}${unit[0]}`
}

/** An action that does nothing, so a path the source left empty stays a valid path. */
export const noOp = (name: string): ConfigEntry => ({
  name,
  type: 'data',
  operator: 'set',
  props: { value: '' },
})
