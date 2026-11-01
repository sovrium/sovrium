/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The SEARCH mode's local rows, drawn in the browser beside the endpoint's
 * results: the PAGES the app's navigation names (handed over by the server,
 * already filtered for this caller), listed only when the typed words match
 * one, and the SEARCH DATA row saying where the search looks
 * (`Search “camille” in users`), worded from the kinds the app declares. The
 * palette carries no theme action: the theme has one home, the account menu.
 */

import { useCallback, type ReactElement } from 'react'
import { CommandGroup, CommandItem } from '../parts/command-primitives'
import { pageMatches, type PalettePage } from './command-actions-data'

/** One page row: named by its navigation label, opening the page. */
function PageItem({
  page,
  onSelect,
}: {
  readonly page: PalettePage
  readonly onSelect: (href: string) => void
}): ReactElement {
  const select = useCallback(() => onSelect(page.path), [onSelect, page.path])
  return (
    <CommandItem
      value={`page:${page.path}`}
      aria-label={page.title}
      onSelect={select}
    >
      <span className="text-foreground truncate font-medium">{page.title}</span>
    </CommandItem>
  )
}

/**
 * The Search data row for `query`: one option naming the words and the kinds
 * of data they are looked for in. The results arrive under it as they are
 * found, so choosing it leaves the palette open on them. Nothing is drawn
 * before the reader types, or when the app declares no kind (`searchIn` empty).
 */
function SearchDataRow({
  query,
  heading,
  sentence,
}: {
  readonly query: string
  readonly heading: string
  readonly sentence: string
}): ReactElement | null {
  const words = query.trim()
  if (words.length === 0 || sentence.length === 0) return null
  const label = sentence.split('{query}').join(words)
  return (
    <CommandGroup heading={heading}>
      <CommandItem
        value="search-data"
        aria-label={label}
      >
        <span>{label}</span>
      </CommandItem>
    </CommandGroup>
  )
}

/** The Pages group and the Search data row for `query`, each drawn only when it applies. */
export function LocalGroups({
  pages,
  strings,
  hints,
  query,
  onSelect,
}: {
  readonly pages: readonly PalettePage[]
  readonly strings: Readonly<Record<string, string>>
  /** The palette's own words: `searchData` and `searchIn`, `{kinds}` already filled. */
  readonly hints: Readonly<Record<string, string | undefined>> | undefined
  readonly query: string
  readonly onSelect: (href: string) => void
}): ReactElement {
  const matched = pageMatches(pages, query)
  return (
    <>
      {matched.length > 0 && (
        <CommandGroup heading={strings['pages'] ?? 'Pages'}>
          {matched.map((page) => (
            <PageItem
              key={page.path}
              page={page}
              onSelect={onSelect}
            />
          ))}
        </CommandGroup>
      )}
      <SearchDataRow
        query={query}
        heading={hints?.['searchData'] ?? 'Search data'}
        sentence={hints?.['searchIn'] ?? ''}
      />
    </>
  )
}
