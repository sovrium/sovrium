/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import type { SearchState } from './use-page-search'
import type { KeyboardEvent } from 'react'

/**
 * The page search's keyboard, on the ARIA combobox pattern: the focus stays in
 * the field while the arrow keys move a highlighted result (the field names it
 * as its active descendant), Enter opens the highlighted result — the first
 * when none is — and Escape closes the panel, then, pressed again, clears the
 * query.
 */

/**
 * Open a search result. Its address comes from the fetched search index, so it
 * is followed only when it is a page on this site; anything else is ignored.
 */
export const navigateTo = (url: string): void => {
  const target = toSafeRedirectPath(url)
  if (target !== undefined) window.location.assign(target)
}

/** The highlight one arrow press moves to, kept inside the listed results. */
const movedHighlight = (key: string, current: number, count: number): number =>
  key === 'ArrowDown' ? Math.min(current + 1, count - 1) : Math.max(current - 1, 0)

/** Escape: an open panel closes; a closed one clears the query. */
const escape = (state: SearchState, stopQuery: () => void): void => {
  stopQuery()
  state.setActive(-1)
  state.setPending(false)
  if (state.isOpen) {
    state.setIsOpen(false)
    return
  }
  state.setQuery('')
  state.setResults([])
}

/**
 * The field's key handler. `stopQuery` cancels the debounced and the pending
 * query, so a closed panel is not reopened by an answer already on its way.
 */
export function useKeyDownHandler(
  state: SearchState,
  stopQuery: () => void
): (e: KeyboardEvent<HTMLInputElement>) => void {
  return useCallback(
    (e: KeyboardEvent<HTMLInputElement>): void => {
      const { results, isOpen, active } = state
      if (e.key === 'Escape') {
        e.preventDefault()
        escape(state, stopQuery)
        return
      }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && results.length > 0) {
        e.preventDefault()
        state.setIsOpen(true)
        state.setActive((current) => movedHighlight(e.key, current, results.length))
        return
      }
      if (e.key === 'Enter' && isOpen && results.length > 0) {
        e.preventDefault()
        const chosen = results[active >= 0 ? active : 0]
        if (chosen) navigateTo(chosen.url)
      }
    },
    [state, stopQuery]
  )
}
