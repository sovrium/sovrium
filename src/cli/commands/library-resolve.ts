/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which catalogue entry an id typed after `library show|add` names.
 *
 * The catalogue id (`block/login-03`) wins. When none matches, a bare id is
 * read as shadcn/ui's own block id, so `sovrium library add login-03` gives
 * what `npx shadcn add login-03` gives: the entry whose `shadcnBlock` is that
 * id. Two entries claiming the same shadcn id is a refusal naming both, never
 * a silent pick. Pure; the catalogue is passed in, never imported (see the
 * boot-cost note in `library.ts`).
 */

import type { LibraryCatalogueApi, LibraryEntry } from '@/library/manifest/define'

/** The refusal two entries mirroring one shadcn block produce. */
export const ambiguousShadcnIdMessage = (id: string, ids: readonly string[]): string =>
  `Error: "${id}" is the shadcn/ui id of more than one library entry: ${ids.join(', ')}.\n\n` +
  '  Name the one you want by its catalogue id, e.g. ' +
  `\`sovrium library add ${ids[0] ?? id}\`.`

/**
 * The entry `id` names: by catalogue id first, then by shadcn block id.
 * `undefined` when neither matches; `refuse` is called on an ambiguous
 * shadcn id.
 */
export const resolveEntryId = (
  catalogue: Pick<LibraryCatalogueApi, 'libraryEntryId'>,
  entries: readonly LibraryEntry[],
  id: string,
  refuse: (message: string) => never
): LibraryEntry | undefined => {
  const exact = entries.find((candidate) => catalogue.libraryEntryId(candidate) === id)
  if (exact !== undefined) return exact
  const mirrors = entries.filter((candidate) => candidate.shadcnBlock === id)
  if (mirrors.length > 1)
    return refuse(ambiguousShadcnIdMessage(id, mirrors.map(catalogue.libraryEntryId).toSorted()))
  return mirrors[0]
}
