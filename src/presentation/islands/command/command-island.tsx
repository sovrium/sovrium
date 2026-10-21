/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `command` island — the ⌘K palette, drawn through the command menu
 * (`parts/command-primitives`, shadcn's `command` over cmdk) inside a Base UI
 * dialog.
 *
 * Three modes, decided by whether the host declared an `endpoint`, else
 * `groups` (AUTHORED, `command-groups.tsx`), else neither:
 *
 *  - SEARCH: typing (debounced) queries the declared endpoint and lists the
 *    matches grouped by kind, below any declared `groups`; choosing one
 *    navigates to it through the SPA content-swap path. The console's global
 *    search is this mode.
 *  - BUILT-IN (`command-built-in-palette.tsx`): the app's quick actions
 *    ("Create new record in <table>", "Go to <page>", "Toggle dark mode") from
 *    the page's `[data-command-palette-config]` block, and, once the query is
 *    long enough, the pages and records `GET /api/command-search` matches.
 *
 * The list's own filtering is off in both modes: search results arrive
 * already chosen by the server, and the built-in quick actions keep their
 * token match ("new task" finds "Create new record in tasks"). `⌘K`, `Ctrl+K`
 * and a `[data-command-palette-trigger]` press open the palette (see
 * `useOpenIntent`); Escape and the backdrop close it.
 */

import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { consoleHref } from '@/presentation/islands/runtime/mount-base-path'
import { requestSpaNavigation } from '../navigation/spa-nav-request'
import { Command, CommandDialog, CommandInput, CommandList } from '../parts/command-primitives'
import {
  localMatches,
  readPaletteConfig,
  type PaletteConfig,
  type PalettePage,
} from './command-actions-data'
import { BuiltInPalette } from './command-built-in-palette'
import { CreateRecordDialog } from './command-create-dialog'
import { groupsMatchQuery } from './command-group-match'
import { GroupsPalette, SearchedGroups, type AuthoredCommandGroup } from './command-groups'
import { CommandHints, type CommandHintWords } from './command-hints'
import { LocalGroups } from './command-search-local'
import { SearchResults } from './command-search-results'
import { searchPhaseOf, useAdminSearch, useOpenIntent } from './use-command-search'

/** The palette's declared binding, as it arrives from `data-island-props`. */
interface CommandIslandProps {
  /** SEARCH mode's read endpoint, queried per keystroke with `q=`; absent = BUILT-IN. */
  readonly endpoint?: string
  /** Search field placeholder AND its accessible name. */
  readonly placeholder?: string
  /** Group heading per result kind. */
  readonly kindLabels?: Readonly<Record<string, string>>
  /** Row badge per result kind, in the page language. */
  readonly kindBadges?: Readonly<Record<string, string>>
  /** The groups the page declared: in place of the quick actions, or above the search results. */
  readonly groups?: readonly AuthoredCommandGroup[]
  /** The keyboard-hint footer's words, in the page language. */
  readonly hints?: CommandHintWords
  /** SEARCH mode: each table's plural label by its name, naming a record row's table. */
  readonly tableLabels?: Readonly<Record<string, string>>
  /** SEARCH mode: the pages the navigation names, matched in the browser. */
  readonly pages?: readonly PalettePage[]
  /** SEARCH mode: the Pages and Quick actions groups' words, in the page language. */
  readonly strings?: Readonly<Record<string, string>>
}

/** A search palette declaring no groups draws none above its results. */
const NO_GROUPS: readonly AuthoredCommandGroup[] = []

/** A search palette handed no pages or words matches none. */
const NO_PAGES: readonly PalettePage[] = []
const NO_STRINGS: Readonly<Record<string, string>> = {}

/** Close the palette and go to a result's console-root path. */
function useOpenResult(close: () => void): (href: string) => void {
  return useCallback(
    (href: string) => {
      close()
      // A console-root path, re-pointed at whichever mount serves this document.
      const target = consoleHref(href)
      if (requestSpaNavigation(target)) return
      const safe = toSafeRedirectPath(target)
      if (safe !== undefined) window.location.assign(safe)
    },
    [close]
  )
}

/**
 * Whether the typed words found something the endpoint was not asked for — an
 * authored item, a page, the dark-mode toggle — so "No results" stays silent.
 */
const matchedWithoutSearch = (
  groups: readonly AuthoredCommandGroup[],
  local: ReturnType<typeof localMatches>,
  query: string
): boolean =>
  local.pages.length > 0 || local.toggle !== undefined || groupsMatchQuery(groups, query)

/** The SEARCH mode: an endpoint-backed search with its three calm states. */
function SearchPalette({
  host,
  close,
}: {
  readonly host: CommandIslandProps
  readonly close: () => void
}): ReactElement {
  const { kindLabels, kindBadges, tableLabels, hints } = host
  const pages = host.pages ?? NO_PAGES
  const strings = host.strings ?? NO_STRINGS
  const placeholder = host.placeholder ?? hints?.['searchAll'] ?? 'Search all your data'
  const [query, setQuery] = useState('')
  const search = useAdminSearch(query, host.endpoint ?? '')
  const onSelect = useOpenResult(close)
  const groups = host.groups ?? NO_GROUPS
  const matchedLocally = matchedWithoutSearch(groups, localMatches(pages, strings, query), query)
  const phase = searchPhaseOf(query, search)
  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <CommandList
        data-search-state={phase}
        aria-busy={phase === 'searching' ? true : undefined}
      >
        <SearchedGroups
          groups={groups}
          query={query}
          narrow
          close={close}
        />
        <LocalGroups
          pages={pages}
          strings={strings}
          query={query}
          onSelect={onSelect}
          close={close}
        />
        <SearchResults
          matchedLocally={matchedLocally}
          query={query}
          search={search}
          kindLabels={kindLabels}
          kindBadges={kindBadges}
          tableLabels={tableLabels}
          words={hints}
          onSelect={onSelect}
        />
      </CommandList>
      <CommandHints words={hints} />
    </Command>
  )
}

/** The palette's body in the mode its host declared: authored, search or built-in. */
function PaletteBody({
  host,
  config,
  close,
  onCreate,
}: {
  readonly host: CommandIslandProps
  readonly config: PaletteConfig | undefined
  readonly close: () => void
  readonly onCreate: (table: string) => void
}): ReactElement {
  if (host.groups !== undefined && host.endpoint === undefined) {
    return (
      <GroupsPalette
        groups={host.groups}
        hints={host.hints}
        close={close}
      />
    )
  }
  if (config === undefined) {
    return (
      <SearchPalette
        host={host}
        close={close}
      />
    )
  }
  return (
    <BuiltInPalette
      config={config}
      hints={host.hints}
      close={close}
      onCreate={onCreate}
    />
  )
}

/** The ⌘K palette in whichever mode its host declared. */
export default function CommandIsland(host: CommandIslandProps): ReactElement {
  const { endpoint, groups } = host
  const [isOpen, setIsOpen] = useState(false)
  const [creating, setCreating] = useState<string | undefined>(undefined)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const closeCreate = useCallback((next: boolean) => {
    if (!next) setCreating(undefined)
  }, [])
  useOpenIntent(open)
  const config = useMemo(
    () => (endpoint === undefined && groups === undefined ? readPaletteConfig() : undefined),
    [endpoint, groups]
  )

  return (
    <>
      <CommandDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title={
          config === undefined
            ? (host.hints?.['search'] ?? 'Search')
            : (host.hints?.['title'] ?? 'Command palette')
        }
      >
        <PaletteBody
          host={host}
          config={config}
          close={close}
          onCreate={setCreating}
        />
      </CommandDialog>
      {config !== undefined && (
        <CreateRecordDialog
          config={config}
          table={creating}
          onOpenChange={closeCreate}
        />
      )}
    </>
  )
}
