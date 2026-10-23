/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The BUILT-IN mode's list: the app's quick actions, and — once the query is
 * long enough — the pages and records the search endpoint matches.
 *
 * Quick actions come from the page's own config and need no network, so they
 * draw at once. When a query is typed the content matches come FIRST: a reader
 * typing is most likely looking for a page or a record, so the first arrow
 * press should land on one rather than on "Create new record in …".
 */

import { useCallback, useMemo, type ReactElement } from 'react'
import { CommandGroup, CommandItem } from '../parts/command-primitives'
import {
  actionMatchesQuery,
  groupRecordMatches,
  MIN_QUERY_LENGTH,
  quickActions,
  type CommandMatch,
  type PaletteConfig,
} from './command-actions-data'
import { useCommandMatches } from './use-command-search'

/** What choosing an item does: its action token and, for a navigation, where to. */
export type ActivateItem = (action: string, href: string | undefined) => void

function ActionItem({
  label,
  action,
  href,
  onActivate,
  children,
}: {
  readonly label: string
  readonly action: string
  readonly href?: string
  readonly onActivate: ActivateItem
  readonly children?: ReactElement | readonly ReactElement[]
}): ReactElement {
  const select = useCallback(() => onActivate(action, href), [onActivate, action, href])
  return (
    <CommandItem
      value={`${action}|${href ?? ''}|${label}`}
      aria-label={label}
      data-command-action={action}
      data-href={href}
      onSelect={select}
    >
      {children ?? <span>{label}</span>}
    </CommandItem>
  )
}

/** A content-page excerpt, the matched span marked. Text nodes only, never markup. */
function Excerpt({ match }: { readonly match: CommandMatch }): ReactElement | undefined {
  if (!match.excerpt) return undefined
  const range = match.matchRange
  if (!range || range[0] < 0 || range[1] <= range[0]) {
    return <div className="text-muted-foreground text-xs">{match.excerpt}</div>
  }
  return (
    <div className="text-muted-foreground text-xs">
      {match.excerpt.slice(0, range[0])}
      <mark>{match.excerpt.slice(range[0], range[1])}</mark>
      {match.excerpt.slice(range[1])}
    </div>
  )
}

/** One page or record match: its label, a star when favourited, its table, its excerpt. */
function MatchItem({
  match,
  onActivate,
}: {
  readonly match: CommandMatch
  readonly onActivate: ActivateItem
}): ReactElement {
  return (
    <ActionItem
      label={match.label}
      action="navigate"
      href={match.detailPath}
      onActivate={onActivate}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate">
          {match.favorited === true && (
            <span
              data-favorite="true"
              aria-label="favorite"
            >
              {'★ '}
            </span>
          )}
          {match.label}
        </span>
        <Excerpt match={match} />
      </span>
      {match.tableName ? (
        <span
          data-command-palette-table={match.tableName}
          className="text-muted-foreground ml-auto shrink-0 text-xs"
        >
          {match.tableLabel ?? match.tableName}
        </span>
      ) : (
        <span />
      )}
    </ActionItem>
  )
}

/**
 * The page matches, then ONE "Records" group: every record match, its table
 * named beside it, in the order the tables are declared.
 */
function ContentMatches({
  matches,
  pagesHeading,
  recordsHeading,
  onActivate,
}: {
  readonly matches: readonly CommandMatch[]
  readonly pagesHeading: string
  readonly recordsHeading: string
  readonly onActivate: ActivateItem
}): ReactElement {
  const pages = matches.filter((match) => match.entityType === 'page')
  const records = useMemo(
    () =>
      groupRecordMatches(matches.filter((match) => match.entityType !== 'page')).flatMap(
        (group) => group.matches
      ),
    [matches]
  )
  return (
    <>
      {pages.length > 0 && (
        <CommandGroup heading={pagesHeading}>
          {pages.map((match) => (
            <MatchItem
              key={`page:${match.detailPath ?? match.label}`}
              match={match}
              onActivate={onActivate}
            />
          ))}
        </CommandGroup>
      )}
      {records.length > 0 && (
        <CommandGroup heading={recordsHeading}>
          {records.map((match) => (
            <MatchItem
              key={`${match.tableName ?? ''}:${match.detailPath ?? match.label}`}
              match={match}
              onActivate={onActivate}
            />
          ))}
        </CommandGroup>
      )}
    </>
  )
}

/** The built-in palette's groups for the current query. */
export function BuiltInActions({
  config,
  query,
  onActivate,
}: {
  readonly config: PaletteConfig
  readonly query: string
  readonly onActivate: ActivateItem
}): ReactElement {
  const needle = query.trim()
  const matches = useCommandMatches(query)
  const actions = useMemo(
    () =>
      quickActions(config).filter(
        (action) => needle.length === 0 || actionMatchesQuery(action.label, needle)
      ),
    [config, needle]
  )
  return (
    <>
      {needle.length >= MIN_QUERY_LENGTH && matches !== undefined && (
        <ContentMatches
          matches={matches}
          pagesHeading={config.strings['pages'] ?? 'Pages'}
          recordsHeading={config.strings['kind.record'] ?? 'Records'}
          onActivate={onActivate}
        />
      )}
      {actions.length > 0 && (
        <CommandGroup heading={config.strings['quickActions'] ?? 'Quick actions'}>
          {actions.map((action) => (
            <ActionItem
              key={`${action.action}|${action.href ?? ''}|${action.label}`}
              label={action.label}
              action={action.action}
              href={action.href}
              onActivate={onActivate}
            />
          ))}
        </CommandGroup>
      )}
    </>
  )
}
