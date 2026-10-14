/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The SEARCH mode's list: the matches a declared endpoint answers, one named
 * group per kind, plus the three calm states the reader meets on the way (the
 * prompt before anything is typed, the hint while a query is in flight, and
 * the no-results status naming the searched term).
 *
 * The groups and items are the command menu's own (`parts/command-primitives`),
 * so a result is an `option` the arrows reach and Enter chooses. An item's
 * accessible name is the result title alone; the kind beside it is an aside.
 */

import { useCallback, type ReactElement } from 'react'
import { CommandGroup, CommandItem } from '../parts/command-primitives'
import {
  groupLabel,
  resultBadge,
  type AdminSearchGroup,
  type AdminSearchResult,
} from './command-search-data'
import type { SearchState } from './use-command-search'

/** One result: an `option` named by its title, its kind as an aside. */
function ResultItem({
  result,
  badge,
  onSelect,
}: {
  readonly result: AdminSearchResult
  readonly badge: string
  readonly onSelect: (href: string) => void
}): ReactElement {
  const select = useCallback(() => onSelect(result.href), [onSelect, result.href])
  return (
    <CommandItem
      value={`${result.type}:${result.entityId}`}
      aria-label={result.title}
      onSelect={select}
      className="justify-between"
    >
      <span className="text-foreground truncate font-medium">{result.title}</span>
      <span className="text-muted-foreground shrink-0 text-xs">{badge}</span>
    </CommandItem>
  )
}

/** One kind's results, under the heading that names the set. */
function ResultGroup({
  group,
  kindLabels,
  onSelect,
}: {
  readonly group: AdminSearchGroup
  readonly kindLabels: Readonly<Record<string, string>> | undefined
  readonly onSelect: (href: string) => void
}): ReactElement {
  const badge = resultBadge(group.type)
  return (
    <CommandGroup heading={groupLabel(group.type, kindLabels)}>
      {group.results.map((result) => (
        <ResultItem
          key={`${result.type}:${result.entityId}`}
          result={result}
          badge={badge}
          onSelect={onSelect}
        />
      ))}
    </CommandGroup>
  )
}

/** A calm line in place of the list. */
function StateLine({
  status,
  children,
}: {
  readonly status?: boolean
  readonly children: string
}): ReactElement {
  return (
    <p
      role={status === true ? 'status' : undefined}
      className="text-muted-foreground px-3 py-6 text-center text-sm"
    >
      {children}
    </p>
  )
}

/**
 * The list body for the current search state. The prompt names the CORPUS
 * rather than repeating the placeholder, so an empty palette tells the reader
 * what is reachable from here.
 */
export function SearchResults({
  query,
  search,
  kindLabels,
  onSelect,
}: {
  readonly query: string
  readonly search: SearchState
  readonly kindLabels: Readonly<Record<string, string>> | undefined
  readonly onSelect: (href: string) => void
}): ReactElement {
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return (
      <StateLine>
        Start typing to search records, submissions, files, automations and users.
      </StateLine>
    )
  }
  if (search.loading || search.resolvedQuery !== trimmed) {
    return <StateLine status>Searching…</StateLine>
  }
  if (search.groups.length === 0) {
    return <StateLine status>{`No results for “${trimmed}”`}</StateLine>
  }
  return (
    <>
      {search.groups.map((group) => (
        <ResultGroup
          key={group.type}
          group={group}
          kindLabels={kindLabels}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}
