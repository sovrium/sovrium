/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useDebouncedValue } from '../../hooks/use-debounced-value'
import { nullable, READ_ONCE_QUERY_OPTIONS } from '../../runtime/query-client'
import { fetchAdminSearch, type AdminSearchGroup } from './admin-command-palette-data'

/**
 * The palette's behaviour: the open intent it answers, the debounced search
 * it runs against the admin search endpoint, and Escape to close.
 */

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
export function useOpenIntent(open: () => void): void {
  useEffect(() => {
    const flagWindow = window as { __sovriumOpenCommandPalette?: boolean }
    if (flagWindow.__sovriumOpenCommandPalette) {
      flagWindow.__sovriumOpenCommandPalette = false
      open()
    }
    const handler = (): void => open()
    document.addEventListener('sovrium:open-command-palette', handler)
    return () => document.removeEventListener('sovrium:open-command-palette', handler)
  }, [open])
}

/** The debounced global-search state: groups + loading flag, keyed to the query. */
export interface SearchState {
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
export function useAdminSearch(query: string, endpoint: string): SearchState {
  const trimmed = query.trim()
  // The debounce sits on the VALUE, so it lands on the query KEY: a superseded
  // keystroke never has a key of its own, so its answer has no observer to
  // reach and no request-id bookkeeping is needed. A blank query publishes immediately — it makes no request, and
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

/**
 * Close-on-Escape WITHOUT navigating — the dialog owns the key so the page URL
 * stays put. Active only while the palette is open.
 */
export function useCloseOnEscape(isOpen: boolean, close: () => void): void {
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
