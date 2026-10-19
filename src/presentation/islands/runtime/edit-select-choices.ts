/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What an `editSelect` picker offers and what it commits, read the same way
 * by its two drawings: the submenu a table row action opens
 * (`data-table/row-actions/row-edit-submenu.tsx`) and the menu a page button on
 * a record opens (`edit-select-menu.ts`). One reading, so a row and a card
 * holding the same record can never disagree about which value is checked or
 * in which order a list is sent.
 */

/** One choice, by the value it stores and the words it reads as. */
export interface EditSelectChoice {
  readonly value: string
  readonly label: string
}

/** The part of an `editSelect` its choices and commit depend on. */
interface EditSelectShape {
  readonly field: string
  readonly multiple?: boolean
  readonly options?: readonly { readonly value: string; readonly label?: string }[]
}

/** Each option's stored value and the label it reads as. */
export const choicesOf = (editSelect: EditSelectShape): readonly EditSelectChoice[] =>
  (editSelect.options ?? []).map((option) => ({
    value: option.value,
    label: option.label ?? option.value,
  }))

/** A stored value of the edited field, as the strings its choices are keyed by. */
export const currentValuesOf = (stored: unknown): readonly string[] => {
  if (Array.isArray(stored)) return stored.map(String)
  return stored === undefined || stored === null ? [] : [String(stored)]
}

/**
 * A list editor on a record that does not carry its list: the server could not
 * read the value, and saving from it would replace values nobody could see.
 */
export const isUnreadList = (editSelect: EditSelectShape, stored: unknown): boolean =>
  editSelect.multiple === true && !Array.isArray(stored)

/**
 * A list commit: the ticked values in the order the options list them, so the
 * same picks always send the same list. An empty list is the answer "none".
 */
export const pickedInOptionOrder = (
  choices: readonly EditSelectChoice[],
  ticked: readonly string[]
): readonly string[] => choices.map((choice) => choice.value).filter((v) => ticked.includes(v))
