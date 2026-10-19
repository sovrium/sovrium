/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext, useCallback, useContext } from 'react'
import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'

/**
 * The import dialog's words (`csvImport.*`), resolved on the server against the
 * page language and the author's translations and sent only where they differ
 * from English — so the map is empty on an English page and every step keeps
 * the English literal it is written with. No catalogue ships to the browser.
 *
 * The twin of the grid's `GridStringsContext`, kept local to the import island
 * for the same reason: a strings module shared by two islands becomes a chunk
 * of its own and an entry in the eager loader's preload map.
 */
export const ImportWordsContext = createContext<Readonly<Record<string, string>>>({})

/** Reads one dialog word: `t('csvImport.next', 'Next')`, placeholders filled. */
export type ImportTranslate = (
  key: string,
  english: string,
  values?: Readonly<Record<string, string | number>>
) => string

const translateWith =
  (words: Readonly<Record<string, string>>): ImportTranslate =>
  (key, english, values) => {
    const template = words[key] ?? english
    return values === undefined ? template : fillPlaceholders(template, values)
  }

/**
 * One dialog word: the server-resolved text when the host sent one, the English
 * literal otherwise, with `{name}` placeholders filled.
 */
export function useImportWord(
  key: string,
  english: string,
  values?: Readonly<Record<string, string | number>>
): string {
  return translateWith(useContext(ImportWordsContext))(key, english, values)
}

/**
 * The dialog's translate function, for a step that reads words in a loop — a
 * column's accessible name, a field's reading — where one hook per word cannot.
 */
export function useImportWords(): ImportTranslate {
  const words = useContext(ImportWordsContext)
  return useCallback<ImportTranslate>(
    (key, english, values) => translateWith(words)(key, english, values),
    [words]
  )
}
