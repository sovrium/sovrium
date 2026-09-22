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
 * labelled `listbox` per present entity kind (the PLURAL group label is both the
 * heading and the listbox's accessible name; each row carries the SINGULAR badge
 * instead — see `ENTITY_TYPE_BADGES`), and one `option` per result (its
 * accessible name is the result title, so
 * `getByRole('option', { name: /Zaphod/ })` resolves). Plus the three calm
 * states the operator sees: the empty prompt (no query), the loading hint, and
 * the no-results status naming the searched term.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop -- conventional React event-handler pattern (per-row onClick); presentational result rows, not a hot path. */

import { type ReactElement } from 'react'
import {
  groupLabel,
  resultBadge,
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
      // A palette row is a MENU ITEM: the same 5px/8px step, the same 4px
      // radius and the same subtle fill as a dropdown item, because the two are
      // the same gesture reached two ways.
      className="hover:bg-background-subtle flex cursor-pointer items-center justify-between gap-2 rounded-[4px] px-2 py-[5px] text-base"
    >
      <span className="text-foreground truncate font-medium">{result.title}</span>
      {/* The kind reads as an aside after the title, not as a chip. A bordered
          pill on every row draws a second column of boxes down a list whose
          whole job is to be scanned for one word. */}
      <span className="text-foreground-subtle shrink-0 text-xs">{badge}</span>
    </li>
  )
}

/** One per-type group: a labelled `listbox` of result `option`s. */
function ResultGroup({
  group,
  kindLabels,
  onSelect,
}: {
  readonly group: AdminSearchGroup
  readonly kindLabels: Readonly<Record<string, string>> | undefined
  readonly onSelect: (href: string) => void
}): ReactElement {
  const label = groupLabel(group.type, kindLabels)
  // The heading names the SET and the badge names one MEMBER of it, so the two
  // are different words rather than the same string repeated once per row. See
  // `ENTITY_TYPE_BADGES` for why they had to split.
  const badge = resultBadge(group.type)
  return (
    <div className="flex flex-col gap-1">
      <p className="text-foreground-subtle px-2 pt-1.5 pb-0.5 text-xs font-medium tracking-[0.04em] uppercase">
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
            badge={badge}
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
  kindLabels,
  onSelect,
}: {
  readonly groups: ReadonlyArray<AdminSearchGroup>
  readonly kindLabels: Readonly<Record<string, string>> | undefined
  readonly onSelect: (href: string) => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <ResultGroup
          key={group.type}
          group={group}
          kindLabels={kindLabels}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

/**
 * The prompt shown before anything is typed.
 *
 * It names the CORPUS rather than repeating the placeholder. It used to say
 * "Search all your data", which is the placeholder's own text — so an empty
 * palette printed the same sentence twice, and neither instance told the reader
 * what was actually reachable from here.
 */
export function PaletteEmptyPrompt(): ReactElement {
  return (
    <p className="text-foreground-subtle px-3 py-6 text-center text-base">
      Start typing to search records, submissions, files, automations and users.
    </p>
  )
}

/** The loading hint shown while a query is in flight. */
export function PaletteLoading(): ReactElement {
  return (
    <p
      role="status"
      className="text-foreground-subtle px-3 py-6 text-center text-base"
    >
      Searching…
    </p>
  )
}

/** The no-results status, naming the searched term. */
export function PaletteNoResults({ query }: { readonly query: string }): ReactElement {
  return (
    <p
      role="status"
      className="text-foreground-subtle px-3 py-6 text-center text-base"
    >
      {`No results for “${query}”`}
    </p>
  )
}
