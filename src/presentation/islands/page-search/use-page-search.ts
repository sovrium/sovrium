/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `usePageSearch` — the state-machine hook for the page-search island.
 *
 * Owns the query / results / open state, the debounce timer, the document-
 * level outside-click listener, and the unmount cleanup. Exposed as a single
 * hook so `page-search-island.tsx` stays under the size ceiling while
 * keeping a clear public surface (the returned `PageSearchController`).
 *
 * Index loading is module-scoped (one cache shared across every island
 * instance on the page) — see {@link loadIndex} below.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { searchIndex, type SearchIndex, type SearchResult } from './matcher'
import type { ChangeEvent, KeyboardEvent } from 'react'

const DEBOUNCE_MS = 150
const MIN_QUERY_LENGTH = 2

// ── Index fetch + cache (module-scoped, shared by every island instance) ─────

interface IndexCache {
  cached: SearchIndex | undefined
  pending: Promise<SearchIndex | undefined> | undefined
}

const indexCache: IndexCache = { cached: undefined, pending: undefined }

const loadIndex = (): Promise<SearchIndex | undefined> => {
  if (indexCache.cached) return Promise.resolve(indexCache.cached)
  if (indexCache.pending) return indexCache.pending
  const promise: Promise<SearchIndex | undefined> = fetch('/sovrium-search/index.json', {
    credentials: 'same-origin',
  })
    .then(async (r) => {
      if (!r.ok) {
        // eslint-disable-next-line functional/no-throw-statements
        throw new Error(`Failed to load search index: ${r.status}`)
      }
      return (await r.json()) as SearchIndex
    })
    .then((data) => {
      // eslint-disable-next-line functional/immutable-data
      indexCache.cached = data
      // eslint-disable-next-line functional/immutable-data
      indexCache.pending = undefined
      return data
    })
    .catch((err: unknown) => {
      // eslint-disable-next-line functional/immutable-data
      indexCache.pending = undefined
      console.warn('[page-search] index load failed:', err)
      return undefined
    })
  // eslint-disable-next-line functional/immutable-data
  indexCache.pending = promise
  return promise
}

export const navigateTo = (url: string): void => {
  // eslint-disable-next-line functional/immutable-data
  window.location.href = url
}

export interface PageSearchController {
  readonly query: string
  readonly results: ReadonlyArray<SearchResult>
  readonly isOpen: boolean
  readonly containerRef: React.RefObject<HTMLDivElement | null>
  readonly onChange: (e: ChangeEvent<HTMLInputElement>) => void
  readonly onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  readonly onNavigate: (url: string) => void
}

interface DebounceController {
  readonly schedule: (run: () => void) => void
  readonly cancel: () => void
}

/**
 * Encapsulates the debounce timer ref so callers don't have to pass refs
 * around (which would trigger `no-param-reassign`). Mirrors the pattern in
 * `use-inline-editing.ts::useSavedStatusTimer`.
 */
function useDebounce(): DebounceController {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])
  const schedule = useCallback(
    (run: () => void) => {
      cancel()
      // eslint-disable-next-line functional/immutable-data -- ref holds the debounce timer
      timerRef.current = setTimeout(run, DEBOUNCE_MS)
    },
    [cancel]
  )
  useEffect(() => cancel, [cancel])
  return { schedule, cancel }
}

interface SearchState {
  readonly query: string
  readonly results: ReadonlyArray<SearchResult>
  readonly isOpen: boolean
  readonly setQuery: (q: string) => void
  readonly setResults: (r: ReadonlyArray<SearchResult>) => void
  readonly setIsOpen: (open: boolean) => void
}

function useSearchState(): SearchState {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ReadonlyArray<SearchResult>>([])
  const [isOpen, setIsOpen] = useState(false)
  return { query, results, isOpen, setQuery, setResults, setIsOpen }
}

function useRunSearch(
  state: SearchState,
  effectiveMaxResults: number
): (q: string) => Promise<void> {
  const { setResults, setIsOpen } = state
  return useCallback(
    async (q: string): Promise<void> => {
      const trimmed = q.trim()
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setResults([])
        setIsOpen(false)
        return
      }
      const loaded = await loadIndex()
      if (!loaded) {
        setResults([])
        setIsOpen(false)
        return
      }
      const matched = searchIndex(loaded, trimmed, effectiveMaxResults)
      setResults(matched)
      setIsOpen(matched.length > 0)
    },
    [effectiveMaxResults, setResults, setIsOpen]
  )
}

function useChangeHandler(
  state: SearchState,
  runSearch: (q: string) => Promise<void>,
  debounce: DebounceController
): (e: ChangeEvent<HTMLInputElement>) => void {
  const { setQuery, setResults, setIsOpen } = state
  return useCallback(
    (e: ChangeEvent<HTMLInputElement>): void => {
      const nextQuery = e.target.value
      setQuery(nextQuery)
      // Invalidate stale results so users can't click a stale item between
      // keystrokes. `runSearch` reopens once new matches land.
      setResults([])
      setIsOpen(false)
      debounce.schedule(() => {
        void runSearch(nextQuery)
      })
    },
    [runSearch, setQuery, setResults, setIsOpen, debounce]
  )
}

function useKeyDownHandler(
  state: SearchState,
  debounce: DebounceController
): (e: KeyboardEvent<HTMLInputElement>) => void {
  const { setQuery, setResults, setIsOpen, isOpen, results } = state
  return useCallback(
    (e: KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setQuery('')
        setResults([])
        setIsOpen(false)
        debounce.cancel()
        return
      }
      if (e.key === 'Enter' && isOpen && results.length > 0) {
        e.preventDefault()
        const first = results[0]
        if (first) navigateTo(first.url)
      }
    },
    [isOpen, results, setQuery, setResults, setIsOpen, debounce]
  )
}

function useLifecycleEffects(
  isOpen: boolean,
  setIsOpen: (open: boolean) => void,
  containerRef: React.RefObject<HTMLDivElement | null>
): void {
  // Outside-click → collapse panel.
  useEffect(() => {
    if (!isOpen) return
    const handler = (event: globalThis.MouseEvent): void => {
      const root = containerRef.current
      if (!root) return
      const { target } = event
      if (target instanceof Node && root.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, setIsOpen, containerRef])

  // Mark host element ready so `waitForIslandReady` fixture unblocks.
  useEffect(() => {
    const el = containerRef.current
    if (el) el.setAttribute('data-island-ready', 'true')
  }, [containerRef])
}

export function usePageSearch(effectiveMaxResults: number): PageSearchController {
  const state = useSearchState()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const debounce = useDebounce()

  const runSearch = useRunSearch(state, effectiveMaxResults)
  const onChange = useChangeHandler(state, runSearch, debounce)
  const onKeyDown = useKeyDownHandler(state, debounce)
  useLifecycleEffects(state.isOpen, state.setIsOpen, containerRef)

  return {
    query: state.query,
    results: state.results,
    isOpen: state.isOpen,
    containerRef,
    onChange,
    onKeyDown,
    onNavigate: navigateTo,
  }
}
