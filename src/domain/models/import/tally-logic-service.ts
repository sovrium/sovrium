/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Tally's `CONDITIONAL_LOGIC` blocks as form rules.
 *
 * A logic block is `{ conditionals[], logicalOperator, actions[] }`. A
 * conditional is `SINGLE` (a field, a comparison, a value) or a nested `GROUP`;
 * a field reference names an input, a hidden field or a calculated field. A
 * choice is compared by its option id, read here as the option's label.
 *
 * Each action becomes a rule: `SHOW_BLOCKS`, `HIDE_BLOCKS` and `REQUIRE_ANSWER`
 * one per question they name (a title block names its question),
 * `JUMP_TO_PAGE` a jump taken after the question before the logic block, and
 * `CALCULATE` a step on a variable. Any other action is kept as `other`, to be
 * reported.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { objectsOf } from './form-snapshot-service'
import type { CanonicalCondition } from './canonical-flow'
import type { CanonicalForm } from './canonical-form'
import type { TallyNames } from './tally-responses-service'

type Json = Readonly<Record<string, unknown>>
type Rule = CanonicalForm['rules'][number]

/** The id of the n-th page (1-based). */
export const tallyPageId = (page: number): string => `page-${String(page)}`

const payloadOf = (block: Json): Json => (isRecord(block['payload']) ? block['payload'] : {})

const CALCULATE_OPERATORS: Readonly<
  Record<string, 'add' | 'subtract' | 'multiply' | 'divide' | 'set'>
> = {
  ADDITION: 'add',
  SUBTRACTION: 'subtract',
  MULTIPLICATION: 'multiply',
  DIVISION: 'divide',
  ASSIGNMENT: 'set',
}

/** What reading the logic needs: names, block owners and choice labels. */
export interface TallyLookup {
  readonly names: TallyNames
  /** A `PAGE_BREAK` uuid → the page it starts. */
  readonly breaks: ReadonlyMap<string, string>
  /** A logic block uuid → the question before it. */
  readonly anchors: ReadonlyMap<string, string>
  readonly owners: ReadonlyMap<string, string>
  readonly labels: ReadonlyMap<string, string>
}

/** What a logic field reference tests. */
const leftOf = (lookup: TallyLookup, field: Json): unknown => {
  const uuid = String(field['uuid'] ?? '')
  if (field['type'] === 'HIDDEN_FIELD')
    return { hidden: lookup.names.hidden.get(uuid) ?? String(field['title'] ?? uuid) }
  if (field['type'] === 'CALCULATED_FIELD')
    return { variable: lookup.names.variables.get(uuid) ?? String(field['title'] ?? uuid) }
  return { question: String(field['blockGroupUuid'] ?? lookup.owners.get(uuid) ?? uuid) }
}

/** A compared value, a choice's id read as its label. */
const rightOf = (lookup: TallyLookup, value: unknown): unknown => {
  if (typeof value === 'string') return lookup.labels.get(value) ?? value
  if (Array.isArray(value)) return value.map((one) => rightOf(lookup, one))
  return isRecord(value) ? leftOf(lookup, value) : value
}

const conditionOf = (
  lookup: TallyLookup,
  operator: unknown,
  conditionals: unknown
): CanonicalCondition => ({
  combinator: operator === 'OR' ? 'or' : 'and',
  rules: objectsOf(conditionals).map((conditional) => {
    const payload = payloadOf(conditional)
    if (conditional['type'] === 'GROUP') {
      return {
        left: conditionOf(lookup, payload['logicalOperator'], payload['conditionals']),
        operator: 'group',
      }
    }
    return {
      left: isRecord(payload['field']) ? leftOf(lookup, payload['field']) : undefined,
      operator: String(payload['comparison'] ?? ''),
      ...('value' in payload ? { right: rightOf(lookup, payload['value']) } : {}),
    }
  }),
})

const targetsOf = (lookup: TallyLookup, uuids: unknown): readonly string[] => [
  ...new Set(
    (Array.isArray(uuids) ? uuids : [uuids]).map(
      (uuid) => lookup.owners.get(String(uuid)) ?? String(uuid)
    )
  ),
]

/** What every action of one logic block shares. */
interface ActionScope {
  readonly lookup: TallyLookup
  readonly block: Json
  readonly when: CanonicalCondition
}

type ActionRules = (scope: ActionScope, payload: Json, raw: unknown) => readonly Rule[]

/** Show, hide or require rules, one per question the action names. */
const targeted =
  (kind: 'show' | 'hide' | 'require', key: string): ActionRules =>
  ({ lookup, when }, payload, raw) =>
    targetsOf(lookup, payload[key]).map((target) => ({ kind, when, target, raw }))

/** A jump, evaluated after the question before the logic block. */
const jumpRules: ActionRules = ({ lookup, block, when }, payload, raw) => {
  const page = payload['jumpToPage']
  const target =
    typeof page === 'number' ? tallyPageId(page) : (lookup.breaks.get(String(page)) ?? String(page))
  const source = lookup.anchors.get(String(block['uuid']))
  return [{ kind: 'jump', ...(source === undefined ? {} : { source }), when, target, raw }]
}

/** What a calculation step applies: a number, a question's answer or another variable. */
const operandOf = (
  lookup: TallyLookup,
  value: unknown
):
  | { readonly constant: number }
  | { readonly question: string }
  | { readonly variable: string }
  | undefined => {
  if (typeof value === 'number') return { constant: value }
  if (!isRecord(value)) return undefined
  const left = leftOf(lookup, value) as Readonly<Record<string, string>>
  if (left['question'] !== undefined) return { question: left['question'] }
  return left['variable'] === undefined ? undefined : { variable: left['variable'] }
}

/** One calculation step on a variable. */
const calculateRules: ActionRules = ({ lookup, when }, payload, raw) => {
  const calculate = isRecord(payload['calculate']) ? payload['calculate'] : {}
  const field = isRecord(calculate['field']) ? calculate['field'] : {}
  const operator = CALCULATE_OPERATORS[String(calculate['operator'])]
  const operand = operandOf(lookup, calculate['value'])
  return [
    {
      kind: 'calculate',
      when,
      target: lookup.names.variables.get(String(field['uuid'])) ?? String(field['title'] ?? ''),
      ...(operator === undefined || operand === undefined
        ? {}
        : { operation: { operator, operand } }),
      raw,
    },
  ]
}

const ACTIONS: Readonly<Record<string, ActionRules>> = {
  SHOW_BLOCKS: targeted('show', 'showBlocks'),
  HIDE_BLOCKS: targeted('hide', 'hideBlocks'),
  REQUIRE_ANSWER: targeted('require', 'requireAnswer'),
  JUMP_TO_PAGE: jumpRules,
  CALCULATE: calculateRules,
}

/** One logic action as rules; an action Sovrium has no equivalent for is kept as `other`. */
const rulesOfAction = (scope: ActionScope, action: Json): readonly Rule[] => {
  const raw = {
    logic: scope.block['uuid'],
    conditionals: payloadOf(scope.block)['conditionals'],
    action,
  }
  const rules = ACTIONS[String(action['type'])]
  return rules === undefined
    ? [{ kind: 'other', when: scope.when, raw }]
    : rules(scope, payloadOf(action), raw)
}

/** Every rule of a form's logic blocks, in block order. */
export const tallyRulesOf = (lookup: TallyLookup, blocks: readonly Json[]): readonly Rule[] =>
  blocks
    .filter((block) => block['type'] === 'CONDITIONAL_LOGIC')
    .flatMap((block) => {
      const payload = payloadOf(block)
      const when = conditionOf(lookup, payload['logicalOperator'], payload['conditionals'])
      return objectsOf(payload['actions']).flatMap((action) =>
        rulesOfAction({ lookup, block, when }, action)
      )
    })
