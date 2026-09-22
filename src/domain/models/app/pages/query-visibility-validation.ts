/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { boundNodesOf, describeNode } from './record-binding-walk'

// ---------------------------------------------------------------------------
// 17. `visibility.query` — the gate must name a state the page can be in
// ---------------------------------------------------------------------------

/**
 * The decode rules `visibility.query` needs, all three of which refuse a gate
 * that is DEAD rather than wrong.
 *
 * That is the whole character of this family. A `visibility.record` typo shows a
 * component on no rows and the author sees an empty list; a `visibility.query`
 * typo shows it under no URL, and the page looks complete because the OTHER
 * branch renders. Nothing observable distinguishes "the gate never matches" from
 * "this state is rare", so the refusal has to happen at decode or not at all.
 *
 * `page.query` CLAMPS rather than refusing — a URL value outside the declared
 * `enum` resolves to `default` and the page answers 200 — which is exactly what
 * makes an out-of-enum comparison unreachable rather than merely unlikely.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The four operators that compare NUMERICALLY, and a declared `enum` holds
 * strings.
 *
 * `contains` stays: a query value is a string and substring containment is a
 * meaningful, if rare, question about one. `eq` / `neq` / `in` / `notIn` are the
 * four this key exists for.
 */
const NUMERIC_OPERATORS = ['gt', 'lt', 'gte', 'lte'] as const

/** The operators whose declared values must be members of the property's enum. */
const VALUE_OPERATORS = ['eq', 'neq', 'contains'] as const
const LIST_OPERATORS = ['in', 'notIn'] as const

export function queryVisibilityViolations(
  page: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  const declared = isRecord(page['query']) ? page['query'] : {}

  return boundNodesOf(page).flatMap(({ node }) => {
    const gate = queryGateOf(node)
    if (gate === undefined) return []
    const { name } = gate
    if (typeof name !== 'string') return []
    const where = `${label} gates ${describeNode(node)} on \`visibility.query\``

    const prop = declared[name]
    if (!isRecord(prop)) {
      return [
        `${where} property "${name}", which \`page.query\` does not declare — the value is never resolved, so the gate matches nothing and the component renders under no URL at all. Declare the property, or drop the gate.`,
      ]
    }
    return [...operatorViolations(gate, name, where), ...valueViolations(gate, prop, name, where)]
  })
}

/**
 * The gate, read from BOTH the schema position and the legacy `props` one.
 *
 * `extractVisibility` in the runtime filter reads both, so a rule reading only
 * one would decline to refuse exactly the pages an author wrote in the older
 * spelling — and those are the pages most likely to carry a stale property name.
 */
function queryGateOf(
  node: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> | undefined {
  const fromProps = isRecord(node['props']) ? node['props']['visibility'] : undefined
  const visibility = isRecord(fromProps) ? fromProps : node['visibility']
  if (!isRecord(visibility)) return undefined
  const gate = visibility['query']
  return isRecord(gate) ? gate : undefined
}

/** The four numeric comparisons, which a closed set of strings cannot satisfy. */
function operatorViolations(
  gate: Readonly<Record<string, unknown>>,
  name: string,
  where: string
): readonly string[] {
  const used = NUMERIC_OPERATORS.filter((operator) => gate[operator] !== undefined)
  if (used.length === 0) return []
  return [
    `${where} property "${name}" with the numeric operator(s) [${used.join(', ')}]. A query property's values are a declared list of STRINGS, so an ordering comparison over them is never satisfied. Use eq / neq / in / notIn.`,
  ]
}

/**
 * Every value the gate compares against must be a member of the property's own
 * `enum`.
 *
 * `contains` is exempt from membership — it asks about a SUBSTRING, and a
 * substring of an enum member is legitimately not a member itself.
 */
function valueViolations(
  gate: Readonly<Record<string, unknown>>,
  prop: Readonly<Record<string, unknown>>,
  name: string,
  where: string
): readonly string[] {
  const allowed = prop['enum']
  if (!Array.isArray(allowed)) return []

  const compared = [
    ...VALUE_OPERATORS.filter((operator) => operator !== 'contains').flatMap((operator) =>
      typeof gate[operator] === 'string' ? [gate[operator]] : []
    ),
    ...LIST_OPERATORS.flatMap((operator) =>
      Array.isArray(gate[operator])
        ? (gate[operator] as readonly unknown[]).filter(
            (value): value is string => typeof value === 'string'
          )
        : []
    ),
  ]
  const unreachable = [...new Set(compared)].filter((value) => !allowed.includes(value))
  if (unreachable.length === 0) return []

  return [
    `${where} property "${name}" against value(s) [${unreachable.join(', ')}] that its enum [${allowed.join(', ')}] does not contain. A URL value outside the enum resolves to the default, so this comparison can never hold and the component renders nowhere.`,
  ]
}
