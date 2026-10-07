/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `admin-command-palette` island — the ⌘K global search palette
 *.
 *
 * [internal ref] broadened the palette from a fixed page-jump list into a
 * CROSS-ENTITY GLOBAL SEARCH. `⌘K` / `Ctrl+K` (and the shell's "Search"
 * affordance) open the dialog; typing a query (debounced ~200ms) hits
 * `GET /api/admin/search?q=` and renders the matches GROUPED BY TYPE with a
 * per-type badge. Selecting a result navigates to its deep-link through the SPA
 * content-swap path (`requestSpaNavigation`); a record result deep-links to
 * `/_admin/tables/{name}?record={id}`, which auto-opens the record drawer.
 * `Escape` closes without navigating. The palette shows three calm states: the
 * empty prompt (no query), a loading hint, and a no-results status.
 */

import { useCallback, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { consoleHref } from '@/presentation/islands/runtime/mount-base-path'
import { requestSpaNavigation } from '../../navigation/spa-nav-request'
import {
  GroupedResults,
  PaletteEmptyPrompt,
  PaletteLoading,
  PaletteNoResults,
} from './admin-command-palette-results'
import { useOpenIntent, useAdminSearch, useCloseOnEscape } from './use-admin-search'
import type { SearchState } from './use-admin-search'

/** The palette searchbox: a controlled `search` input advertising global scope. */
function PaletteSearchbox({
  query,
  setQuery,
  placeholder,
}: {
  readonly query: string
  readonly setQuery: (value: string) => void
  readonly placeholder: string
}): ReactElement {
  return (
    <input
      autoFocus
      type="search"
      role="searchbox"
      aria-label={placeholder}
      placeholder={placeholder}
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      // Flush with the panel's top edge, marked off by one hairline. A bordered
      // box inside a bordered box reads as two panels; the reference draws the
      // search as a ROW of the panel, not as a control sitting in it. No focus
      // ring for the same reason: it is focused the instant the palette opens,
      // so a ring here is permanent chrome rather than a state.
      //
      // `outline-none` alone did not deliver that, and the reason is not in
      // this file: the base stylesheet gives EVERY `input` a focus ring built
      // from a box-shadow pair rather than an outline, so the row drew one
      // anyway. The panel is `overflow-hidden` with this control flush against
      // its top edge, so the ring could not even be drawn whole — three of its
      // sides were clipped by the rounded corners and what reached the screen
      // was a bright bar under the field, which reads as a rendering fault
      // rather than as focus. Both layers of that pair are cancelled here:
      // `ring-0` is not enough on its own, because the ring's width is
      // `ring + offset` and the offset survives it.
      className="border-border text-foreground w-full border-0 border-b bg-transparent px-3 py-2 text-base outline-none focus:ring-0 focus:ring-offset-0"
    />
  )
}

/** Pick the body to render for the current search state. */
function PaletteBody({
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
  if (query.trim().length === 0) return <PaletteEmptyPrompt />
  if (search.loading || search.resolvedQuery !== query.trim()) return <PaletteLoading />
  if (search.groups.length === 0) return <PaletteNoResults query={query.trim()} />
  return (
    <GroupedResults
      groups={search.groups}
      kindLabels={kindLabels}
      onSelect={onSelect}
    />
  )
}

/** The palette dialog body: global searchbox + grouped results / state. */
function PaletteDialog({
  query,
  setQuery,
  search,
  placeholder,
  kindLabels,
  onSelect,
}: {
  readonly query: string
  readonly setQuery: (value: string) => void
  readonly search: SearchState
  readonly placeholder: string
  readonly kindLabels: Readonly<Record<string, string>> | undefined
  readonly onSelect: (href: string) => void
}): ReactElement {
  return (
    <div
      role="dialog"
      aria-modal="true"
      // ONE accessible name. It used to concatenate three strings — "Search",
      // a descriptive palette title, and the config-native component name —
      // purely so that three separate specs could each substring-match the
      // dialog by their own preferred name. A screen reader announced all
      // three. Test locators are not a reason to degrade an accessible name;
      // the specs now agree on this one, and a `data-testid` is the right
      // tool if a test ever needs a handle of its own.
      aria-label="Search"
      // `shadow-lg`, not `shadow-xl`: the `xl` step was retired from the scale,
      // and the utility had been silently falling through to Tailwind's own
      // stock elevation — a shadow from outside the design system on the most
      // prominent overlay in the console.
      //
      // No padding on the panel itself. The search row is flush to the top edge
      // and the result list carries its own 4px, which is what lets the row's
      // hairline run the full width instead of stopping 16px short of it.
      className="border-border bg-background-raised mx-auto mt-[12vh] flex w-full max-w-xl flex-col overflow-hidden rounded-md border shadow-lg"
    >
      <PaletteSearchbox
        query={query}
        setQuery={setQuery}
        placeholder={placeholder}
      />
      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto p-1">
        <PaletteBody
          query={query}
          search={search}
          kindLabels={kindLabels}
          onSelect={onSelect}
        />
      </div>
      <p className="border-border text-foreground-subtle border-t px-3 py-2 text-sm">
        Esc to close
      </p>
    </div>
  )
}

/** The portaled, dismiss-on-backdrop overlay wrapping the palette dialog. */
function PaletteOverlay({
  onDismiss,
  children,
}: {
  readonly onDismiss: () => void
  readonly children: ReactElement
}): ReactElement {
  // Portal to `document.body` so the overlay escapes the shell's `hidden`
  // (`display: none`) marker host. The `fixed inset-0` overlay anchors the
  // centered dialog to the viewport.
  return createPortal(
    <div
      data-overlay
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
      className="bg-scrim/50 fixed inset-0 z-50 overflow-y-auto p-4"
    >
      {children}
    </div>,
    document.body
  )
}

/** The palette's declared binding, as it arrives from `data-island-props`. */
interface CommandPaletteIslandProps {
  /** Read endpoint the palette queries; `q=` is appended per keystroke. */
  readonly endpoint?: string
  /** Searchbox placeholder AND its accessible name. */
  readonly placeholder?: string
  /** Group heading per result kind, overriding the console's built-ins. */
  readonly kindLabels?: Readonly<Record<string, string>>
}

/** The console's own binding, used when the host declared none. */
const DEFAULT_ENDPOINT = '/api/admin/search'
const DEFAULT_PLACEHOLDER = 'Search all your data'

/** The ⌘K command palette surface — the cross-entity global search. */
export default function AdminCommandPaletteIsland({
  endpoint = DEFAULT_ENDPOINT,
  placeholder = DEFAULT_PLACEHOLDER,
  kindLabels,
}: CommandPaletteIslandProps = {}): ReactElement | undefined {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  useOpenIntent(open)
  useCloseOnEscape(isOpen, close)

  const search = useAdminSearch(query, endpoint)

  const onSelect = useCallback(
    (href: string): void => {
      close()
      // Search hrefs are PERSISTED in the index as console-root paths, so they
      // are re-pointed at whichever mount is serving this document. Doing it
      // here — at the one place a hit is navigated to — is what keeps a second
      // mount's palette from teleporting the operator to the default mount, and
      // it needs no reindex when a mount moves.
      //
      // Route the selection through the SPA content-swap path so the persistent
      // sidebar + palette stay mounted; the nav island falls back to a full
      // navigation itself if the partial is unavailable.
      requestSpaNavigation(consoleHref(href))
    },
    [close]
  )

  if (!isOpen) return undefined
  return (
    <PaletteOverlay onDismiss={close}>
      <PaletteDialog
        query={query}
        setQuery={setQuery}
        search={search}
        placeholder={placeholder}
        kindLabels={kindLabels}
        onSelect={onSelect}
      />
    </PaletteOverlay>
  )
}
