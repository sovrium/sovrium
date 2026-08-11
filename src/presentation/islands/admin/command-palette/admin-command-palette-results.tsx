/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Result-list sub-components for the `admin-command-palette` island
 *. Split out of the island body to keep both
 * files under the per-island `max-lines` cap.
 *
 * The broadened palette renders the global-search matches GROUPED BY TYPE: one
 * labelled `listbox` per present entity kind (the French type label is the
 * listbox's accessible name AND the per-result badge), and one `option` per
 * result (its accessible name is the result title, so
 * `getByRole('option', { name: /Zaphod/ })` resolves). Plus the three calm
 * states the operator sees: the empty prompt (no query), the loading hint, and
 * the no-results status naming the searched term.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop -- conventional React event-handler pattern (per-row onClick); presentational result rows, not a hot path. */

import { type ReactElement } from 'react'
import {
  ENTITY_TYPE_LABELS,
  type AdminSearchGroup,
  type AdminSearchResult,
} from './admin-command-palette-data'

/** One result row: an `option` whose accessible name is the result title. */
function ResultOption({
  result,
  badge,
  onSelect,
}: {
  readonly result: AdminSearchResult
  readonly badge: string
  readonly onSelect: (href: string) => void
}): ReactElement {
  return (
    <li
      role="option"
      aria-label={result.title}
      aria-selected="false"
      onClick={() => onSelect(result.href)}
      className="hover:bg-background-subtle flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm"
    >
      <span className="text-foreground truncate font-medium">{result.title}</span>
      <span className="border-border text-foreground-subtle shrink-0 rounded border px-1.5 py-0.5 text-xs">
        {badge}
      </span>
    </li>
  )
}

/** One per-type group: a labelled `listbox` of result `option`s. */
function ResultGroup({
  group,
  onSelect,
}: {
  readonly group: AdminSearchGroup
  readonly onSelect: (href: string) => void
}): ReactElement {
  const label = ENTITY_TYPE_LABELS[group.type]
  return (
    <div className="flex flex-col gap-1">
      <p className="text-foreground-subtle px-1 text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <ul
        role="listbox"
        aria-label={label}
        className="flex flex-col gap-1"
      >
        {group.results.map((result) => (
          <ResultOption
            key={`${result.type}:${result.entityId}`}
            result={result}
            badge={label}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  )
}

/** The grouped global-search result list (one labelled listbox per kind). */
export function GroupedResults({
  groups,
  onSelect,
}: {
  readonly groups: ReadonlyArray<AdminSearchGroup>
  readonly onSelect: (href: string) => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <ResultGroup
          key={group.type}
          group={group}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

/** The calm prompt shown when no query is typed (invites a global search). */
export function PaletteEmptyPrompt(): ReactElement {
  return (
    <p className="text-foreground-subtle px-3 py-6 text-center text-sm">Search all your data</p>
  )
}

/** The loading hint shown while a query is in flight. */
export function PaletteLoading(): ReactElement {
  return (
    <p
      role="status"
      className="text-foreground-subtle px-3 py-6 text-center text-sm"
    >
      Recherche en cours…
    </p>
  )
}

/** The no-results status, naming the searched term. */
export function PaletteNoResults({ query }: { readonly query: string }): ReactElement {
  return (
    <p
      role="status"
      className="text-foreground-subtle px-3 py-6 text-center text-sm"
    >
      {`No results for “${query}”`}
    </p>
  )
}
