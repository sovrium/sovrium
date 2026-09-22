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
 * content-swap path (`navigateAdminSpa`); a record result deep-links to
 * `/_admin/tables/{name}?record={id}`, which auto-opens the record drawer.
 * `Escape` closes without navigating. The palette shows three calm states: the
 * empty prompt (no query), a loading hint, and a no-results status.
 */

import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { consoleHref } from '@/presentation/islands/runtime/mount-base-path'
import { useDebouncedValue } from '../../hooks/use-debounced-value'
import { nullable, READ_ONCE_QUERY_OPTIONS } from '../../runtime/query-client'
import { navigateAdminSpa } from '../spa-nav/admin-spa-nav'
import { fetchAdminSearch, type AdminSearchGroup } from './admin-command-palette-data'
import {
  GroupedResults,
  PaletteEmptyPrompt,
  PaletteLoading,
  PaletteNoResults,
} from './admin-command-palette-results'

/** Debounce window (ms) before a query change fires the search request. */
const DEBOUNCE_MS = 200

/**
 * Subscribe to the palette open intent. The `⌘K` / `Ctrl+K` shortcut and the
 * shell's "Search" affordance are captured EARLY by the islands bootstrap
 * (`installCommandPaletteOpenCapture` in `island-client`), which dispatches a
 * `sovrium:open-command-palette` event AND sets `window.__sovriumOpenCommandPalette`
 * — so an open intent that landed before this island hydrated is not lost. This
 * hook replays a pending flag on mount and subscribes to the live event after.
 */
function useOpenIntent(open: () => void): void {
  useEffect(() => {
    const flagWindow = window as unknown as { __sovriumOpenCommandPalette?: boolean }
    if (flagWindow.__sovriumOpenCommandPalette) {
      // eslint-disable-next-line functional/immutable-data -- one-shot consume of the transient client-side open-intent flag (not domain state)
      flagWindow.__sovriumOpenCommandPalette = false
      open()
    }
    const handler = (): void => open()
    document.addEventListener('sovrium:open-command-palette', handler)
    return () => document.removeEventListener('sovrium:open-command-palette', handler)
  }, [open])
}

/** The debounced global-search state: groups + loading flag, keyed to the query. */
interface SearchState {
  readonly groups: ReadonlyArray<AdminSearchGroup>
  readonly loading: boolean
  /** The trimmed query the current `groups` correspond to ('' = no search yet). */
  readonly resolvedQuery: string
}

/**
 * Run the debounced global search for `query`. A blank query resets to the empty
 * prompt without a request; a non-blank query sets `loading`, waits the debounce,
 * fetches, and stores the flattened groups.
 */
function useAdminSearch(query: string, endpoint: string): SearchState {
  const trimmed = query.trim()
  // The debounce sits on the VALUE, so it lands on the query KEY. That is what
  // retires the monotonic request-id ref this hook used to keep: a superseded
  // keystroke never had a key of its own, so its answer has no observer to
  // reach. A blank query publishes immediately — it makes no request, and
  // waiting out 200 ms to clear the panel would leave results under an empty box.
  const debounced = useDebouncedValue(trimmed, DEBOUNCE_MS, (value) => value.length === 0)
  const enabled = debounced.length > 0

  // A refused search resolves `null` and reads as no results, which is what
  // `response?.groups ?? []` did. It is not an error state: the palette has no
  // way to report one, and retrying would be a request the old hook never made.
  const { data } = useQuery({
    queryKey: ['admin-search', endpoint, debounced],
    queryFn: nullable(() => fetchAdminSearch(debounced, endpoint)),
    enabled,
    ...READ_ONCE_QUERY_OPTIONS,
  })

  if (!enabled) return { groups: [], loading: false, resolvedQuery: '' }
  // `loading` is raised from the KEYSTROKE, not from the request — the box
  // showed a spinner through the debounce window too. `PaletteBody` renders that
  // spinner whenever `resolvedQuery` trails the box, so the groups carried
  // alongside it are never read; reporting an empty list here keeps the state
  // honest about what has actually resolved.
  if (data === undefined || debounced !== trimmed) {
    return { groups: [], loading: true, resolvedQuery: '' }
  }
  return { groups: data?.groups ?? [], loading: false, resolvedQuery: debounced }
}

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
      // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- conventional controlled-input onChange
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

/**
 * Close-on-Escape WITHOUT navigating — the dialog owns the key so the page URL
 * stays put. Active only while the palette is open.
 */
function useCloseOnEscape(isOpen: boolean, close: () => void): void {
  useEffect(() => {
    if (!isOpen) return
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, close])
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
      // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- backdrop dismissal (close, no navigation)
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
      navigateAdminSpa(consoleHref(href))
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
