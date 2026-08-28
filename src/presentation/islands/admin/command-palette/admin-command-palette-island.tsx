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

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
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
function useAdminSearch(query: string): SearchState {
  const [state, setState] = useState<SearchState>({ groups: [], loading: false, resolvedQuery: '' })
  const requestId = useRef(0)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length === 0) {
      setState({ groups: [], loading: false, resolvedQuery: '' })
      return undefined
    }
    setState((prev) => ({ ...prev, loading: true }))
    const id = requestId.current + 1
    // eslint-disable-next-line functional/immutable-data -- ref slot tracking the latest in-flight request to drop stale responses
    requestId.current = id
    const timer = setTimeout(() => {
      void fetchAdminSearch(trimmed).then((response) => {
        if (requestId.current !== id) return
        setState({ groups: response?.groups ?? [], loading: false, resolvedQuery: trimmed })
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  return state
}

/** The palette searchbox: a controlled `search` input advertising global scope. */
function PaletteSearchbox({
  query,
  setQuery,
}: {
  readonly query: string
  readonly setQuery: (value: string) => void
}): ReactElement {
  return (
    <input
      autoFocus
      type="search"
      role="searchbox"
      aria-label="Search all your data"
      placeholder="Search all your data"
      value={query}
      // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- conventional controlled-input onChange
      onChange={(event) => setQuery(event.target.value)}
      className="border-border bg-background-raised text-foreground rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
    />
  )
}

/** Pick the body to render for the current search state. */
function PaletteBody({
  query,
  search,
  onSelect,
}: {
  readonly query: string
  readonly search: SearchState
  readonly onSelect: (href: string) => void
}): ReactElement {
  if (query.trim().length === 0) return <PaletteEmptyPrompt />
  if (search.loading || search.resolvedQuery !== query.trim()) return <PaletteLoading />
  if (search.groups.length === 0) return <PaletteNoResults query={query.trim()} />
  return (
    <GroupedResults
      groups={search.groups}
      onSelect={onSelect}
    />
  )
}

/** The palette dialog body: global searchbox + grouped results / state. */
function PaletteDialog({
  query,
  setQuery,
  search,
  onSelect,
}: {
  readonly query: string
  readonly setQuery: (value: string) => void
  readonly search: SearchState
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
      className="border-border bg-background mx-auto mt-[12vh] flex w-full max-w-xl flex-col gap-2 rounded-lg border p-4 shadow-xl"
    >
      <PaletteSearchbox
        query={query}
        setQuery={setQuery}
      />
      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        <PaletteBody
          query={query}
          search={search}
          onSelect={onSelect}
        />
      </div>
      <p className="text-foreground-subtle px-1 text-xs">Esc to close</p>
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

/** The ⌘K command palette surface — the cross-entity global search. */
export default function AdminCommandPaletteIsland(): ReactElement | undefined {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  useOpenIntent(open)
  useCloseOnEscape(isOpen, close)

  const search = useAdminSearch(query)

  const onSelect = useCallback(
    (href: string): void => {
      close()
      // Route the selection through the SPA content-swap path so the persistent
      // sidebar + palette stay mounted; the nav island falls back to a full
      // navigation itself if the partial is unavailable.
      navigateAdminSpa(href)
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
        onSelect={onSelect}
      />
    </PaletteOverlay>
  )
}
