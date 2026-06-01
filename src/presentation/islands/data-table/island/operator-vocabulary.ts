/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const UI_TO_API_OPERATOR: Readonly<Record<string, string>> = {
  is: 'equals',
  'is not': 'notEquals',
  'not equals': 'notEquals',
  'greater than': 'greaterThan',
  'less than': 'lessThan',
  'greater than or equal': 'greaterThanOrEqual',
  'less than or equal': 'lessThanOrEqual',
  'does not contain': 'doesNotContain',
  'starts with': 'startsWith',
  'ends with': 'endsWith',
  'is before': 'isBefore',
  'is after': 'isAfter',
  'is any of': 'isAnyOf',
  'is none of': 'isNoneOf',
  between: 'between',
}

const API_REVERSE_EXCLUDED = new Set(['equals', 'between', 'isAnyOf', 'isNoneOf'])

export const API_TO_UI_OPERATOR: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(UI_TO_API_OPERATOR)
    .filter(([, apiOp]) => !API_REVERSE_EXCLUDED.has(apiOp))
    .map(([uiOp, apiOp]) => [apiOp, uiOp])
)
