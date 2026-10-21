/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The comparison tables of form logic: one per form source, the operator in
 * the tool's own words → the `visibleWhen` operator it becomes.
 *
 * A jump hides the questions it skips, so the mapper needs every condition AND
 * its opposite: a question is shown when the jump is NOT taken. An operator
 * with no opposite in the `visibleWhen` vocabulary (`contains`) can still show
 * or require a question, but a jump on it is reported rather than turned into
 * a visibility rule that would be wrong for some answers.
 */

import type { FormSourceTool } from './form-question-mappings'
import type { VisibleWhen } from '@/domain/models/app/forms/visible-when'

type ConditionOperator = VisibleWhen['operator']

/** What a source operator becomes: a comparison, or a condition that always holds. */
export type LogicOperator = ConditionOperator | 'always'

const TYPEFORM: Readonly<Record<string, LogicOperator>> = {
  is: 'eq',
  equal: 'eq',
  is_not: 'neq',
  not_equal: 'neq',
  contains: 'contains',
  greater_than: 'gt',
  greater_equal_than: 'gte',
  lower_than: 'lt',
  lower_equal_than: 'lte',
  on: 'eq',
  not_on: 'neq',
  earlier_than: 'lt',
  earlier_than_or_on: 'lte',
  later_than: 'gt',
  later_than_or_on: 'gte',
  answered: 'notEmpty',
  always: 'always',
}

const TALLY: Readonly<Record<string, LogicOperator>> = {
  IS: 'eq',
  IS_NOT: 'neq',
  EQUAL: 'eq',
  NOT_EQUAL: 'neq',
  IS_ANY_OF: 'in',
  IS_NOT_ANY_OF: 'notIn',
  CONTAINS: 'contains',
  IS_EMPTY: 'empty',
  IS_NOT_EMPTY: 'notEmpty',
  GREATER_THAN: 'gt',
  LESS_THAN: 'lt',
  GREATER_OR_EQUAL_THAN: 'gte',
  LESS_OR_EQUAL_THAN: 'lte',
  IS_BEFORE: 'lt',
  IS_AFTER: 'gt',
}

/**
 * Google Forms branches on a choice option: the one comparison it makes is
 * "the answer is this option".
 */
const GOOGLE_FORMS: Readonly<Record<string, LogicOperator>> = { is: 'eq' }

/**
 * Every form source's comparison table. Jotform's logic is reported rather
 * than converted, and Fillout and Microsoft Forms expose none, so their tables
 * are empty.
 */
export const LOGIC_OPERATORS: Readonly<
  Record<FormSourceTool, Readonly<Record<string, LogicOperator>>>
> = {
  typeform: TYPEFORM,
  tally: TALLY,
  fillout: {},
  jotform: {},
  'google-forms': GOOGLE_FORMS,
  'microsoft-forms': {},
  webflow: {},
}

/** The opposite of each comparison, where `visibleWhen` has one. */
const OPPOSITES: Readonly<Partial<Record<ConditionOperator, ConditionOperator>>> = {
  eq: 'neq',
  neq: 'eq',
  gt: 'lte',
  lte: 'gt',
  gte: 'lt',
  lt: 'gte',
  empty: 'notEmpty',
  notEmpty: 'empty',
  in: 'notIn',
  notIn: 'in',
}

/** Look a source operator up in its tool's table; `undefined` when it has no equivalent. */
export const lookupLogicOperator = (
  tool: FormSourceTool,
  operator: string
): LogicOperator | undefined => LOGIC_OPERATORS[tool][operator]

/** The opposite comparison, or `undefined` when `visibleWhen` has none. */
export const oppositeOperator = (operator: ConditionOperator): ConditionOperator | undefined =>
  OPPOSITES[operator]
