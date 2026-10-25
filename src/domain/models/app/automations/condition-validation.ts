/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { nestedLists } from './reserved-step-name-validation'

/**
 * The two condition refusals a config gets before it runs.
 *
 * 1. A LIST value on an operator that compares one value (`equals: [a, b]`).
 *    Read as text the list would match nothing, and the run would report an
 *    empty result as a success, so it is refused wherever a condition is
 *    written, pointing at `in` and `notIn`.
 * 2. `matches` in the `filter` of a record step. A record filter runs in the
 *    database, and neither engine evaluates a regular expression the way a
 *    branch does (SQLite has no regular-expression function). Accepting it
 *    would compile to some other test, so it is refused naming the operator.
 *    It stays valid in a branch or `filter/continue` condition, which runs in
 *    the automation.
 *
 * Pure: plain values in, messages out.
 */

/** The operators whose value is a list of candidates. */
export const SET_OPERATORS: ReadonlySet<string> = new Set(['in', 'notIn'])

/**
 * The refusal of one condition whose value is a list on an operator that
 * compares one value, or `true` when the condition is acceptable.
 */
export const listValueRefusal = (condition: {
  readonly operator: string
  readonly value?: unknown
}): true | string =>
  Array.isArray(condition.value) && !SET_OPERATORS.has(condition.operator)
    ? `operator "${condition.operator}" compares one value, but the value is a list: use "in" to keep a value that is one of the list, or "notIn" for one that is none of it`
    : true

/**
 * The operators a record filter compiles into SQL: every condition operator
 * except `matches`, which neither database evaluates the way a branch does.
 * The one closed set the boot-time refusal below and the run-time check of a
 * filter a run hands over (a batch item, a template) both read. An operator
 * outside it is refused, never compiled as something else.
 */
export const COMPILABLE_FILTER_OPERATORS: readonly string[] = [
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'isEmpty',
  'isNotEmpty',
  'isNull',
  'isNotNull',
  'in',
  'notIn',
]

const COMPILABLE: ReadonlySet<string> = new Set(COMPILABLE_FILTER_OPERATORS)

/** Whether a record filter compiles `operator`. */
export const isCompilableFilterOperator = (operator: unknown): boolean =>
  typeof operator === 'string' && COMPILABLE.has(operator)

/** Why a record filter refuses `operator`, naming the operators it accepts. */
export const uncompilableOperatorMessage = (operator: string): string =>
  `operator "${operator}" cannot be used in a record filter. Accepted operators: ${COMPILABLE_FILTER_OPERATORS.join(', ')}`

/** A plain value a list may hold: text, a number, true/false or null. */
const isPlainValue = (member: unknown): boolean =>
  member === null || ['string', 'number', 'boolean'].includes(typeof member)

/**
 * Why an `in` / `notIn` condition a run filled cannot be evaluated: its list
 * holds an object or a nested list, which is neither flattened nor turned into
 * text. Undefined when the condition is another operator or its list is plain.
 * A list written in the config is already held to this at decode.
 */
export const listMemberRefusal = (condition: unknown): string | undefined => {
  if (condition === null || typeof condition !== 'object') return undefined
  const { operator, value } = condition as Raw
  if (typeof operator !== 'string' || !SET_OPERATORS.has(operator)) return undefined
  if (!Array.isArray(value) || value.every(isPlainValue)) return undefined
  return `operator "${operator}" takes a list of plain values — text, a number, true/false or null — but the list it was given holds an object or a nested list`
}

/** The first {@link listMemberRefusal} among a condition group's conditions. */
export const groupListMemberRefusal = (group: unknown): string | undefined => {
  if (group === null || typeof group !== 'object') return undefined
  const { conditions } = group as Raw
  return Array.isArray(conditions)
    ? conditions.map(listMemberRefusal).find((refusal) => refusal !== undefined)
    : undefined
}

/** The record operators whose `filter` is compiled into a database query. */
const RECORD_FILTER_OPERATORS: ReadonlySet<string> = new Set([
  'list',
  'update',
  'delete',
  'batchDelete',
  'upsert',
  'aggregate',
])

/** One refused condition: where it sits under the automation, and why. */
export interface RecordFilterIssue {
  readonly path: readonly (string | number)[]
  readonly issue: string
}

type Raw = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const refusalMessage = (step: string, operator: string): string =>
  operator === 'matches'
    ? `Step '${step}': operator "matches" cannot be used in a record step's filter. The filter runs in the database, which does not evaluate the pattern the way a branch condition does. Use contains, startsWith or endsWith, or test the pattern in a path/branch or filter/continue condition.`
    : `Step '${step}': ${uncompilableOperatorMessage(operator)}`

/** The uncompilable conditions (`matches`) of one record step's filter, with their paths under `at`. */
const ownIssues = (action: Raw, at: readonly (string | number)[]): readonly RecordFilterIssue[] => {
  if (action['type'] !== 'record' || !RECORD_FILTER_OPERATORS.has(String(action['operator']))) {
    return []
  }
  const props = isRecord(action['props']) ? action['props'] : {}
  const filter = isRecord(props['filter']) ? props['filter'] : {}
  const conditions = Array.isArray(filter['conditions']) ? filter['conditions'] : []
  return conditions.flatMap((condition: unknown, index) =>
    isRecord(condition) &&
    typeof condition['operator'] === 'string' &&
    !isCompilableFilterOperator(condition['operator'])
      ? [
          {
            path: [...at, 'props', 'filter', 'conditions', index, 'operator'],
            issue: refusalMessage(String(action['name'] ?? ''), String(condition['operator'])),
          },
        ]
      : []
  )
}

const issuesIn = (
  actions: unknown,
  at: readonly (string | number)[]
): readonly RecordFilterIssue[] =>
  Array.isArray(actions)
    ? actions.flatMap((action: unknown, index) => {
        if (!isRecord(action)) return []
        const path = [...at, index]
        return [
          ...ownIssues(action, path),
          ...nestedLists(action).flatMap(([list, below]) => issuesIn(list, [...path, ...below])),
        ]
      })
    : []

/**
 * One issue per `matches` condition in the filter of a record step that
 * queries the database (list, update, delete, batchDelete, upsert,
 * aggregate), at any depth — a loop's body, a path's branches — each with its
 * path from the automation.
 */
export const findRecordFilterRefusals = (actions: unknown): readonly RecordFilterIssue[] =>
  issuesIn(actions, ['actions'])
