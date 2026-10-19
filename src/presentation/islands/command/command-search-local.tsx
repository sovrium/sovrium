/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The SEARCH mode's two local groups, matched in the browser beside the
 * endpoint's results: the PAGES the app's navigation names (handed over by the
 * server, already filtered for this caller) and the QUICK ACTIONS the palette
 * carries everywhere. Each lists only what the typed words match, so a query
 * no page or action answers draws neither group.
 */

import { useCallback, type ReactElement } from 'react'
import { CommandGroup, CommandItem } from '../parts/command-primitives'
import { localMatches, type PalettePage } from './command-actions-data'
import { toggleDarkMode } from './command-dark-mode'

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

/** The Pages and Quick actions groups for `query`, each drawn only when it matched. */
export function LocalGroups({
  pages,
  strings,
  query,
  onSelect,
  close,
}: {
  readonly pages: readonly PalettePage[]
  readonly strings: Readonly<Record<string, string>>
  readonly query: string
  readonly onSelect: (href: string) => void
  readonly close: () => void
}): ReactElement {
  const matched = localMatches(pages, strings, query)
  const toggle = useCallback(() => {
    close()
    toggleDarkMode(strings)
  }, [close, strings])
  return (
    <>
      {matched.pages.length > 0 && (
        <CommandGroup heading={strings['pages'] ?? 'Pages'}>
          {matched.pages.map((page) => (
            <PageItem
              key={page.path}
              page={page}
              onSelect={onSelect}
            />
          ))}
        </CommandGroup>
      )}
      {matched.toggle !== undefined && (
        <CommandGroup heading={strings['quickActions'] ?? 'Quick actions'}>
          <CommandItem
            value="action:toggle-dark-mode"
            aria-label={matched.toggle}
            onSelect={toggle}
          >
            <span>{matched.toggle}</span>
          </CommandItem>
        </CommandGroup>
      )}
    </>
  )
}
