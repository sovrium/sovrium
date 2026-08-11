/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Single source of truth for the filter-operator UI ↔ API vocabulary bridge.
 *
 * Two consumers used to hand-maintain inverse copies of this mapping:
 *   - `use-saved-views.ts` translated UI → API before persisting a view.
 *   - `filter-operators.ts` translated API → UI when loading a view back.
 *
 * The forward (UI → API) map lives here; the reverse is DERIVED so the two can
 * never drift. See the three-vocabulary chain documented in `filter-operators.ts`.
 */

/**
 * UI-vocabulary operator (spaced English, e.g. `'greater than'`) → API-vocabulary
 * operator (camelCase, as persisted in a saved view's `config.filters[]` JSONB).
 *
 * Operators whose UI and API forms collide (`'contains'`, `'equals'`) are not
 * listed — they pass through `translateUiToApiOperator` unchanged.
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

/**
 * API-vocabulary operators that must NOT appear in the reverse (API → UI) map:
 *
 *   - `equals` / `between` — UI and API forms collide; pass-through is safe and
 *     a reverse entry would mis-map `equals` to the `'is'` alias.
 *   - `isAnyOf` / `isNoneOf` — multi-value operators handled separately by
 *     `classifyMultiValueOperator`, never by the single-value normalizer.
 */
const API_REVERSE_EXCLUDED = new Set(['equals', 'between', 'isAnyOf', 'isNoneOf'])

/**
 * Reverse map: API-vocabulary operator → UI-vocabulary operator. DERIVED from
 * {@link UI_TO_API_OPERATOR} (minus {@link API_REVERSE_EXCLUDED}) so it can
 * never drift from the forward direction.
 *
 * Note: the forward map has two UI keys collapsing to `notEquals`
 * (`'is not'` and `'not equals'`); the later entry (`'not equals'`) wins the
 * reverse, matching the historical hand-maintained table.
 */
export const API_TO_UI_OPERATOR: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(UI_TO_API_OPERATOR)
    .filter(([, apiOp]) => !API_REVERSE_EXCLUDED.has(apiOp))
    .map(([uiOp, apiOp]) => [apiOp, uiOp])
)
