/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium library search` ranking: every term must match, and an exact id,
 * a slug, a provider, a tag, the title, the category and the description weigh
 * in that order. Pure; the catalogue is passed in, never imported (see the
 * boot-cost note in `library.ts`).
 */

import type { LibraryCatalogueApi, LibraryEntry } from '@/library/manifest/define'

/** How well one entry matches one lower-cased term. Zero means no match. */
const termScore = (catalogue: LibraryCatalogueApi, entry: LibraryEntry, term: string): number => {
  const includes = (text: string): boolean => text.toLowerCase().includes(term)
  return [
    catalogue.libraryEntryId(entry) === term || entry.slug === term ? 100 : 0,
    entry.slug.includes(term) ? 50 : 0,
    entry.provider?.name.toLowerCase() === term ? 40 : 0,
    entry.tags.some((tag) => tag.toLowerCase() === term) ? 30 : 0,
    includes(entry.title) ? 20 : 0,
    includes(entry.category) ? 10 : 0,
    includes(entry.description) ? 5 : 0,
  ].reduce((sum, score) => sum + score, 0)
}

/** A query as the lower-cased terms every hit must match. */
export const termsOf = (query: string): readonly string[] =>
  query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term !== '')

/** Every entry matching EVERY term, best first, ties broken by id. */
export const rankEntries = (
  catalogue: LibraryCatalogueApi,
  entries: readonly LibraryEntry[],
  terms: readonly string[]
): readonly LibraryEntry[] =>
  entries
    .map((entry) => ({
      entry,
      scores: terms.map((term) => termScore(catalogue, entry, term)),
    }))
    .filter(({ scores }) => scores.every((score) => score > 0))
    .map(({ entry, scores }) => ({ entry, score: scores.reduce((a, b) => a + b, 0) }))
    .toSorted(
      (left, right) =>
        right.score - left.score ||
        catalogue.libraryEntryId(left.entry).localeCompare(catalogue.libraryEntryId(right.entry))
    )
    .map(({ entry }) => entry)
