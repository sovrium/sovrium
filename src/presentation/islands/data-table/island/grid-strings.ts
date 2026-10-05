/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext, useContext } from 'react'
import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'

/**
 * The grid's own interface strings (`datatable.*`: toolbar, pager, search
 * default, add-row), resolved on the server against the page language and the
 * author's translations, and sent only where they differ from English — so the
 * map is empty on an English page and every control keeps the English literal
 * it is written with. No catalog ships to the browser.
 */
export type GridStrings = Readonly<Record<string, string>>

/**
 * Provided once at the island root so the controls deep in the grid read their
 * strings where they draw them, instead of each taking a prop through every
 * layer in between. Empty by default: a grid mounted without a provider draws
 * English.
 *
 * Local to this island on purpose: a strings module shared with another island
 * becomes a chunk of its own, and every chunk adds an entry to the eager island
 * loader's preload map.
 */
export const GridStringsContext = createContext<GridStrings>({})

/**
 * One grid interface string: the server-resolved text when the host sent one,
 * the English literal otherwise, with `{name}` placeholders filled.
 */
export function useGridString(
  key: string,
  english: string,
  values?: Readonly<Record<string, string | number>>
): string {
  const template = useContext(GridStringsContext)[key] ?? english
  return values === undefined ? template : fillPlaceholders(template, values)
}
