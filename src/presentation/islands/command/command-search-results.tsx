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

/**
 * The table a record result belongs to, read off its link
 * (`…/tables/<name>?record=…`), when the host named that table.
 */
const tableOf = (result: AdminSearchResult): string | undefined =>
  /\/(?:tables|records)\/([^/?#]+)/.exec(result.href)?.[1]

const tableLabelOf = (
  result: AdminSearchResult,
  tableLabels: Readonly<Record<string, string>> | undefined
): string | undefined => {
  if (result.type !== 'record' || tableLabels === undefined) return undefined
  const table = tableOf(result)
  return table === undefined ? undefined : tableLabels[table]
}

/**
 * The row's identity: its kind and its id — a record's qualified by its table
 * (read off its link, else the link itself), since two tables' records share
 * an id as soon as both hold a row. Not the link alone: every user or
 * connection hit links to the same list page. A hit with no id falls back to
 * its link and its position.
 */
const rowKeyOf = (result: AdminSearchResult, index: number): string => {
  if (result.entityId === '') return `${result.type}:${result.href}:${String(index)}`
  if (result.type !== 'record') return `${result.type}:${result.entityId}`
  return `record:${tableOf(result) ?? result.href}:${result.entityId}`
}

/**
 * One result: an `option` named by its title. A record row says which table it
 * comes from, by the table's plural label, before its title; any other row
 * carries its kind as an aside. `rowKey` is its identity (see `rowKeyOf`).
 */
function ResultItem({
  result,
  rowKey,
  badge,
  table,
  onSelect,
}: {
  readonly result: AdminSearchResult
  readonly rowKey: string
  readonly badge: string
  readonly table: string | undefined
  readonly onSelect: (href: string) => void
}): ReactElement {
  const select = useCallback(() => onSelect(result.href), [onSelect, result.href])
  return (
    <CommandItem
      value={rowKey}
      aria-label={result.title}
      onSelect={select}
      className="justify-between"
    >
      <span className="text-foreground truncate font-medium">
        {table === undefined ? result.title : `${table} · ${result.title}`}
      </span>
      {table === undefined && (
        <span className="text-muted-foreground shrink-0 text-xs">{badge}</span>
      )}
    </CommandItem>
  )
}

/** One kind's results, under the heading that names the set. */
function ResultGroup({
  group,
  kindLabels,
  tableLabels,
  onSelect,
}: {
  readonly group: AdminSearchGroup
  readonly kindLabels: Readonly<Record<string, string>> | undefined
  readonly tableLabels: Readonly<Record<string, string>> | undefined
  readonly onSelect: (href: string) => void
}): ReactElement {
  const badge = resultBadge(group.type)
  return (
    <CommandGroup heading={groupLabel(group.type, kindLabels)}>
      {group.results.map((result, index) => (
        <ResultItem
          key={rowKeyOf(result, index)}
          rowKey={rowKeyOf(result, index)}
          result={result}
          badge={badge}
          table={tableLabelOf(result, tableLabels)}
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
  tableLabels,
  words,
  onSelect,
}: {
  readonly query: string
  readonly search: SearchState
  readonly kindLabels: Readonly<Record<string, string>> | undefined
  readonly tableLabels: Readonly<Record<string, string>> | undefined
  /** The palette's words in the page language (`startTyping`, `searching`, `noResultsFor`). */
  readonly words?: Readonly<Record<string, string | undefined>> | undefined
  readonly onSelect: (href: string) => void
}): ReactElement {
  const trimmed = query.trim()
  const word = (key: string, english: string): string => words?.[key] ?? english
  if (trimmed.length === 0) {
    return (
      <StateLine>
        {word(
          'startTyping',
          'Start typing to search records, submissions, files, automations and users.'
        )}
      </StateLine>
    )
  }
  if (search.loading || search.resolvedQuery !== trimmed) {
    return <StateLine status>{word('searching', 'Searching…')}</StateLine>
  }
  if (search.groups.length === 0) {
    const none = word('noResultsFor', 'No results for “{query}”')
    return <StateLine status>{none.split('{query}').join(trimmed)}</StateLine>
  }
  return (
    <>
      {search.groups.map((group) => (
        <ResultGroup
          key={group.type}
          group={group}
          kindLabels={kindLabels}
          tableLabels={tableLabels}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}
