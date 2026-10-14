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
 * Three modes: AUTHORED when the host carries declared `groups`
 * (`command-groups.tsx`), else decided by whether it declared an `endpoint`:
 *
 *  - SEARCH: typing (debounced) queries the declared endpoint and lists the
 *    matches grouped by kind; choosing one navigates to it through the SPA
 *    content-swap path. The console's global search is this mode.
 *  - BUILT-IN: the app's quick actions ("Create new record in <table>",
 *    "Go to <page>", "Toggle dark mode") from the page's
 *    `[data-command-palette-config]` block, and, once the query is long
 *    enough, the pages and records `GET /api/command-search` matches.
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
import { renderToast } from '../runtime/toast'
import { BuiltInActions } from './command-actions'
import { readPaletteConfig, type PaletteConfig } from './command-actions-data'
import { CreateRecordDialog } from './command-create-dialog'
import { GroupsPalette, type AuthoredCommandGroup } from './command-groups'
import { SearchResults } from './command-search-results'
import { useAdminSearch, useOpenIntent } from './use-command-search'

/** The palette's declared binding, as it arrives from `data-island-props`. */
interface CommandIslandProps {
  /** SEARCH mode's read endpoint, queried per keystroke with `q=`; absent = BUILT-IN. */
  readonly endpoint?: string
  /** Search field placeholder AND its accessible name. */
  readonly placeholder?: string
  /** Group heading per result kind. */
  readonly kindLabels?: Readonly<Record<string, string>>
  /** AUTHORED mode: the groups the page declared, in place of the built-in quick actions. */
  readonly groups?: readonly AuthoredCommandGroup[]
}

/** Flip the page between light and dark, and say which it is now. */
function toggleDarkMode(): void {
  const root = document.documentElement
  const enable = !root.classList.contains('dark')
  root.classList.toggle('dark', enable)
  renderToast(enable ? 'Dark mode enabled' : 'Light mode enabled')
}

/** The SEARCH mode: an endpoint-backed search with its three calm states. */
function SearchPalette({
  endpoint,
  placeholder,
  kindLabels,
  close,
}: {
  readonly endpoint: string
  readonly placeholder: string
  readonly kindLabels: Readonly<Record<string, string>> | undefined
  readonly close: () => void
}): ReactElement {
  const [query, setQuery] = useState('')
  const search = useAdminSearch(query, endpoint)
  const onSelect = useCallback(
    (href: string) => {
      close()
      // Search hrefs are persisted as console-root paths, so they are re-pointed
      // at whichever mount serves this document, here at the one place a hit is
      // navigated to. The nav island falls back to a full navigation itself.
      requestSpaNavigation(consoleHref(href))
    },
    [close]
  )
  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <CommandList>
        <SearchResults
          query={query}
          search={search}
          kindLabels={kindLabels}
          onSelect={onSelect}
        />
      </CommandList>
      <p className="text-muted-foreground border-t px-3 py-2 text-xs">Esc to close</p>
    </Command>
  )
}

/** The BUILT-IN mode: quick actions and the content matches. */
function BuiltInPalette({
  config,
  close,
  onCreate,
}: {
  readonly config: PaletteConfig
  readonly close: () => void
  readonly onCreate: (table: string) => void
}): ReactElement {
  const [query, setQuery] = useState('')
  const onActivate = useCallback(
    (action: string, href: string | undefined) => {
      close()
      if (action === 'toggle-dark-mode') {
        toggleDarkMode()
      } else if (action.startsWith('create-record:')) {
        onCreate(action.slice('create-record:'.length))
      } else {
        // A page path or a record's detail path, both this instance's own.
        const target = toSafeRedirectPath(href)
        if (target !== undefined) window.location.assign(target)
      }
    },
    [close, onCreate]
  )
  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search…"
        aria-label="Search"
      />
      <CommandList>
        <BuiltInActions
          config={config}
          query={query}
          onActivate={onActivate}
        />
      </CommandList>
    </Command>
  )
}

/** The ⌘K palette in whichever mode its host declared. */
export default function CommandIsland({
  endpoint,
  placeholder = 'Search all your data',
  kindLabels,
  groups,
}: CommandIslandProps = {}): ReactElement {
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
        title={config === undefined ? 'Search' : 'Command palette'}
      >
        {groups !== undefined ? (
          <GroupsPalette
            groups={groups}
            close={close}
          />
        ) : config === undefined ? (
          <SearchPalette
            endpoint={endpoint ?? ''}
            placeholder={placeholder}
            kindLabels={kindLabels}
            close={close}
          />
        ) : (
          <BuiltInPalette
            config={config}
            close={close}
            onCreate={setCreating}
          />
        )}
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
