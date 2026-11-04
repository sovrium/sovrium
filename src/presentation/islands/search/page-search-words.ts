/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page search's words and ids, shared by the field and its panels.
 */

/**
 * The panel's words, resolved by the server in the page language
 * (`search.searching`, `search.noResultsFor`, `search.resultCount`,
 * `search.resultCountOne`); English when absent.
 */
export interface PageSearchWords {
  readonly searching: string
  readonly noResultsFor: string
  readonly resultCount: string
  readonly resultCountOne: string
}

export const ENGLISH_WORDS: PageSearchWords = {
  searching: 'Searching…',
  noResultsFor: 'No results for “{query}”',
  resultCount: '{count} results',
  resultCountOne: '{count} result',
}

/** A word with its `{name}` placeholder filled. */
export const fill = (word: string, name: string, value: string): string =>
  word.replaceAll(`{${name}}`, value)

/** The id of the `index`th option, which the field names as its active descendant. */
export const optionId = (listboxId: string, index: number): string => `${listboxId}-option-${index}`
