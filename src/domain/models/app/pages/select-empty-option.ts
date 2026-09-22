/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Folding a `select`'s `emptyOption` into its resolved option list.
 *
 * ONE projection, applied once, before either renderer sees the list — so the
 * platform `<select>` (`native: true`) and the themed listbox receive the same
 * array and cannot disagree about what is in it. Putting the row in the SSR
 * markup alone would have left the hydrated island a choice short; putting it in
 * the island props alone would have left the no-JavaScript reader one short.
 *
 * Lives in the `pages` slug, beside `substitute-record-vars`: it folds a select
 * COMPONENT's `emptyOption` into the list both renderers read, and its importer
 * is an island form component. (`select-option`, one directory away in `tables`,
 * normalises a select FIELD's options — a different feature with a similar
 * name.) This module names no `effect` symbol, so folding one row into an array
 * costs the client bundle nothing.
 */

/** One resolved choice, as both select renderers consume it. */
export interface SelectOptionPair {
  readonly label: string
  readonly value: string
}

/**
 * The submitted value of the unset choice.
 *
 * Fixed, not configurable. A shared-filter publisher already publishes `''` for
 * a cleared selection, and the fetch layer already drops an empty value from
 * the URL — so "All" needs no special case anywhere downstream.
 */
export const SELECT_EMPTY_OPTION_VALUE = ''

/** True for the `{ label: string }` shape `emptyOption` decodes to. */
const isEmptyOptionDeclaration = (value: unknown): value is { readonly label: string } =>
  value !== null &&
  typeof value === 'object' &&
  typeof (value as Record<string, unknown>)['label'] === 'string' &&
  (value as Record<string, unknown>)['label'] !== ''

/**
 * Return `options` with the unset choice prepended, or `options` untouched when
 * the component declares none.
 *
 * `options` is taken as `unknown` and returned as `unknown` because that is what
 * the renderer's own single-lookup helper hands over — a component's fields are
 * read off a loosely-typed record. A non-array `options` beside a declared
 * `emptyOption` still yields the one-row list rather than throwing: an
 * unresolved source is exactly the case where the row matters most, since
 * without it the control would fall back to its inert placeholder.
 *
 * `localizeLabel` resolves the label through the active language. It is a
 * parameter rather than an import because translation catalogs live in the
 * presentation layer, and `$t:` substitution never reaches a component's
 * top-level fields — the same reason `tabs` and `accordion` localise their
 * children's captions in the renderer.
 */
export const withEmptyOption = (
  options: unknown,
  emptyOption: unknown,
  localizeLabel: (label: string) => string = (label) => label
): unknown => {
  if (!isEmptyOptionDeclaration(emptyOption)) return options
  const rest = Array.isArray(options) ? (options as readonly unknown[]) : []
  const row: SelectOptionPair = {
    label: localizeLabel(emptyOption.label),
    value: SELECT_EMPTY_OPTION_VALUE,
  }
  return [row, ...rest]
}
