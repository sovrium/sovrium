/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The expression and condition registries: one per automation source.
 *
 * - **Functions**: a function of the source's template language → the Sovrium
 *   template helper that does the same thing, with the same arguments in the
 *   same order. A function with no row stays as text and is a TODO; a helper
 *   that only resembles the source's function (a `capitalize` that upper-cases
 *   the first letter of the text, not of each word) gets no row.
 * - **Comparisons**: an operator of the source's filters and routers → a
 *   Sovrium comparison operator. An operator with no row makes the rule a TODO.
 * - **Branch modes**: whether a source's router runs only the first matching
 *   branch, or every matching one, when the flow does not say.
 *
 * Source names are as each tool spells them in its export (n8n filter
 * operators as `<type>:<operation>`, Make operators as `text:equal`).
 */

import type { AutomationSourceTool } from './flow-step-mappings'
import type { ComparisonOperator } from '@/domain/models/app/automations/conditions'

/** How one argument of a source function is rewritten before it is passed on. */
export type ArgumentConversion = 'moment-date-format'

/** One row of a function registry. */
export interface FunctionMapping {
  /** The function name, as the source spells it. */
  readonly source: string
  /** The Sovrium template helper (`template-helpers.docs.md`). */
  readonly helper: string
  /** The fewest and the most arguments the row accepts; any other count is a TODO. */
  readonly arity: readonly [number, number]
  /** Arguments to rewrite, by position; the argument must then be a constant. */
  readonly convert?: Readonly<Record<number, ArgumentConversion>>
}

const fn = (
  source: string,
  helper: string,
  arity: readonly [number, number],
  convert?: Readonly<Record<number, ArgumentConversion>>
): FunctionMapping => ({ source, helper, arity, ...(convert === undefined ? {} : { convert }) })

/**
 * Make's IML functions (`{{formatDate(now; "YYYY-MM-DD")}}`). Make formats
 * dates with Moment.js tokens, which are rewritten to Sovrium's closed token
 * set; a token with no Sovrium equivalent makes the call a TODO.
 */
const MAKE_FUNCTIONS: readonly FunctionMapping[] = [
  fn('now', 'now', [0, 0]),
  fn('lower', 'lowercase', [1, 1]),
  fn('upper', 'uppercase', [1, 1]),
  fn('trim', 'trim', [1, 1]),
  fn('length', 'length', [1, 1]),
  fn('ifempty', 'default', [2, 2]),
  fn('if', 'if', [3, 3]),
  fn('substring', 'substring', [3, 3]),
  fn('contains', 'contains', [2, 2]),
  fn('first', 'first', [1, 1]),
  fn('last', 'last', [1, 1]),
  fn('join', 'join', [2, 2]),
  fn('split', 'split', [2, 2]),
  fn('keys', 'keys', [1, 1]),
  fn('round', 'round', [1, 1]),
  fn('ceil', 'ceil', [1, 1]),
  fn('floor', 'floor', [1, 1]),
  fn('md5', 'md5', [1, 1]),
  fn('sha256', 'sha256', [1, 1]),
  fn('base64', 'base64Encode', [1, 1]),
  fn('encodeURL', 'urlEncode', [1, 1]),
  fn('decodeURL', 'urlDecode', [1, 1]),
  fn('stripHTML', 'stripHtml', [1, 1]),
  fn('escapeHTML', 'escapeHtml', [1, 1]),
  fn('formatDate', 'formatDate', [2, 3], { 1: 'moment-date-format' }),
  fn('parseDate', 'parseDate', [2, 3], { 1: 'moment-date-format' }),
  fn('addMinutes', 'addMinutes', [2, 2]),
  fn('addHours', 'addHours', [2, 2]),
  fn('addDays', 'addDays', [2, 2]),
  fn('addMonths', 'addMonths', [2, 2]),
  fn('addYears', 'addYears', [2, 2]),
]

/**
 * Every source's function registry. n8n expressions are JavaScript, so a call
 * there is a method call and never maps; Zapier mappings carry no functions
 * (its Formatter is a step of its own).
 */
export const FUNCTION_MAPPINGS: Readonly<Record<AutomationSourceTool, readonly FunctionMapping[]>> =
  {
    n8n: [],
    make: MAKE_FUNCTIONS,
    zapier: [],
    'retool-workflows': [],
    baserow: [],
    webflow: [],
  }

/** The registry row for a source function, or `undefined` when it is a TODO. */
export const lookupFunction = (
  tool: AutomationSourceTool,
  name: string
): FunctionMapping | undefined => FUNCTION_MAPPINGS[tool].find((row) => row.source === name)

/**
 * n8n filter operators (IF v2, Switch v3 and Filter nodes), keyed
 * `<type>:<operation>`. A string rule the node compares case-insensitively is
 * keyed with a `:ci` suffix by the adapter and has no row: Sovrium compares
 * text as written.
 */
const N8N_OPERATORS: Readonly<Record<string, ComparisonOperator>> = {
  'string:equals': 'equals',
  'string:notEquals': 'notEquals',
  'string:contains': 'contains',
  'string:notContains': 'notContains',
  'string:startsWith': 'startsWith',
  'string:endsWith': 'endsWith',
  'string:regex': 'matches',
  'string:exists': 'isNotNull',
  'string:notExists': 'isNull',
  'string:empty': 'isEmpty',
  'string:notEmpty': 'isNotEmpty',
  'number:equals': 'equals',
  'number:notEquals': 'notEquals',
  'number:gt': 'greaterThan',
  'number:gte': 'greaterThanOrEqual',
  'number:lt': 'lessThan',
  'number:lte': 'lessThanOrEqual',
  'number:exists': 'isNotNull',
  'number:notExists': 'isNull',
  'number:empty': 'isEmpty',
  'number:notEmpty': 'isNotEmpty',
  'boolean:equals': 'equals',
  'boolean:notEquals': 'notEquals',
  'boolean:exists': 'isNotNull',
  'boolean:notExists': 'isNull',
  'array:contains': 'contains',
  'array:notContains': 'notContains',
  'array:empty': 'isEmpty',
  'array:notEmpty': 'isNotEmpty',
  'any:exists': 'isNotNull',
  'any:notExists': 'isNull',
}

/** Make filter operators, as listed in the pinned router and filter reference. */
const MAKE_OPERATORS: Readonly<Record<string, ComparisonOperator>> = {
  'text:equal': 'equals',
  'text:notequal': 'notEquals',
  'text:contain': 'contains',
  'text:startwith': 'startsWith',
  'text:pattern': 'matches',
  'number:equal': 'equals',
  'number:greater': 'greaterThan',
  'number:less': 'lessThan',
  'number:greaterorequal': 'greaterThanOrEqual',
  'boolean:equal': 'equals',
  'array:contain': 'contains',
  exist: 'isNotEmpty',
  notexist: 'isEmpty',
}

/**
 * Zapier filter `match` values; a rule whose `action` is `stop` is keyed
 * `stop:<match>`, the negation. Only `exact` is read in a pinned export, and
 * that export is synthetic; the rest wait for a real one.
 */
const ZAPIER_OPERATORS: Readonly<Record<string, ComparisonOperator>> = {
  exact: 'equals',
  'stop:exact': 'notEquals',
}

/**
 * Retool Branch comparisons, the JavaScript operators of a statement the
 * adapter reads (`retool-workflow-expression-service.ts`). Loose and strict
 * equality map alike: Sovrium compares the values as written.
 */
const RETOOL_WORKFLOWS_OPERATORS: Readonly<Record<string, ComparisonOperator>> = {
  '===': 'equals',
  '==': 'equals',
  '!==': 'notEquals',
  '!=': 'notEquals',
  '>': 'greaterThan',
  '>=': 'greaterThanOrEqual',
  '<': 'lessThan',
  '<=': 'lessThanOrEqual',
}

/** Every source's comparison registry. */
export const CONDITION_OPERATORS: Readonly<
  Record<AutomationSourceTool, Readonly<Record<string, ComparisonOperator>>>
> = {
  n8n: N8N_OPERATORS,
  make: MAKE_OPERATORS,
  zapier: ZAPIER_OPERATORS,
  'retool-workflows': RETOOL_WORKFLOWS_OPERATORS,
  baserow: {},
  webflow: {},
}

/** The Sovrium operators that test a value on its own, with no operand. */
export const UNARY_OPERATORS: ReadonlySet<ComparisonOperator> = new Set([
  'isEmpty',
  'isNotEmpty',
  'isNull',
  'isNotNull',
])

/**
 * How a source's router runs when the flow does not say. A Make router sends
 * each bundle down every route whose filter passes, in route order, and a
 * Zapier Path runs every path whose rules match; an n8n IF or Switch, a Retool
 * conditional and a Baserow router take the first branch that matches.
 */
export const BRANCH_MODE_DEFAULTS: Readonly<
  Record<AutomationSourceTool, 'first-match' | 'all-matching'>
> = {
  n8n: 'first-match',
  make: 'all-matching',
  zapier: 'all-matching',
  'retool-workflows': 'first-match',
  baserow: 'first-match',
  webflow: 'first-match',
}
