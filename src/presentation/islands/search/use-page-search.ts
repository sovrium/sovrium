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
 * instance on the page, and with the vanilla runtime) — see
 * {@link ./page-search-index}.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { warnInBrowser } from '../runtime/client-log'
import { loadSearchIndex } from './page-search-index'
import { navigateTo, useKeyDownHandler } from './page-search-keys'
import { searchIndex, type SearchIndex, type SearchResult } from './page-search-matcher'
import { querySessionIndex } from './page-search-session-query'
import type { ChangeEvent, KeyboardEvent } from 'react'

const DEBOUNCE_MS = 150
const MIN_QUERY_LENGTH = 2

/** The static index, or none when it could not be had: an empty panel is then the honest answer. */
const loadIndex = (): Promise<SearchIndex | undefined> =>
  loadSearchIndex().catch((err: unknown) => {
    warnInBrowser('page-search', 'index load failed:', err)
    return undefined
  })

export interface PageSearchController {
  readonly query: string
  readonly results: ReadonlyArray<SearchResult>
  readonly isOpen: boolean
  /** A session query is on its way: the panel says so and keeps the results it lists. */
  readonly pending: boolean
  /** The result the arrow keys highlight, or -1 for none. */
  readonly active: number
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
      timerRef.current = setTimeout(run, DEBOUNCE_MS)
    },
    [cancel]
  )
  useEffect(() => cancel, [cancel])
  return { schedule, cancel }
}

export interface SearchState {
  readonly query: string
  readonly results: ReadonlyArray<SearchResult>
  readonly isOpen: boolean
  readonly pending: boolean
  readonly active: number
  readonly setQuery: (q: string) => void
  readonly setResults: (r: ReadonlyArray<SearchResult>) => void
  readonly setIsOpen: (open: boolean) => void
  readonly setPending: (pending: boolean) => void
  readonly setActive: (update: number | ((current: number) => number)) => void
}

function useSearchState(): SearchState {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ReadonlyArray<SearchResult>>([])
  const [isOpen, setIsOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [active, setActive] = useState(-1)
  return {
    ...{ query, results, isOpen, pending, active },
    ...{ setQuery, setResults, setIsOpen, setPending, setActive },
  }
}

/** The static public index, loaded once and matched in the browser. */
const matchStaticIndex = async (
  q: string,
  maxResults: number
): Promise<ReadonlyArray<SearchResult>> => {
  const loaded = await loadIndex()
  return loaded ? searchIndex(loaded, q, maxResults) : []
}

interface QueryAbort {
  /** Cancel the pending query, if any, and hand out the signal of the next one. */
  readonly next: () => AbortSignal
  /** Cancel the pending query, if any: the reader typed past it. */
  readonly abort: () => void
}

/** At most one session query is pending: each new one, or a keystroke, cancels the last. */
function useQueryAbort(): QueryAbort {
  const controllerRef = useRef<AbortController | undefined>(undefined)
  const abort = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = undefined
  }, [])
  const next = useCallback(() => {
    abort()
    const controller = new AbortController()
    controllerRef.current = controller
    return controller.signal
  }, [abort])
  useEffect(() => abort, [abort])
  return useMemo(() => ({ next, abort }), [next, abort])
}

/** Which index the box reads: the static one, or the server per query — over one collection page, with `page`. */
export interface PageSearchSource {
  readonly maxResults: number
  readonly sessionIndex: boolean
  readonly page?: string | undefined
}

function useRunSearch(
  state: SearchState,
  source: PageSearchSource,
  queryAbort: QueryAbort
): (q: string) => Promise<void> {
  const { setResults, setIsOpen, setPending, setActive } = state
  const { maxResults: effectiveMaxResults, sessionIndex, page } = source
  // Only the latest query may paint: a slow answer to "EU" must not overwrite
  // the answer to "EUR" that arrived first.
  const latest = useRef('')
  return useCallback(
    async (q: string): Promise<void> => {
      const trimmed = q.trim()
      latest.current = trimmed
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setResults([])
        setIsOpen(false)
        setPending(false)
        return
      }
      // A session query takes a round trip: the panel opens on it at once,
      // keeping the results it already lists until the answer replaces them.
      if (sessionIndex) {
        setPending(true)
        setIsOpen(true)
      }
      const matched = sessionIndex
        ? await querySessionIndex(trimmed, effectiveMaxResults, {
            signal: queryAbort.next(),
            page,
          })
        : await matchStaticIndex(trimmed, effectiveMaxResults)
      if (matched === undefined || latest.current !== trimmed) return
      setResults(matched)
      setActive(-1)
      setPending(false)
      // Open on no result too: the panel then says nothing matched the query.
      setIsOpen(true)
    },
    [
      effectiveMaxResults,
      sessionIndex,
      page,
      setResults,
      setIsOpen,
      setPending,
      setActive,
      queryAbort,
    ]
  )
}

function useChangeHandler(
  state: SearchState,
  runSearch: (q: string) => Promise<void>,
  debounce: DebounceController,
  sessionIndex: { readonly enabled: boolean; readonly abort: QueryAbort }
): (e: ChangeEvent<HTMLInputElement>) => void {
  const { setQuery, setResults, setIsOpen, setActive } = state
  const { enabled, abort } = sessionIndex
  return useCallback(
    (e: ChangeEvent<HTMLInputElement>): void => {
      const nextQuery = e.target.value
      setQuery(nextQuery)
      abort.abort()
      setActive(-1)
      // The static index answers within the debounce, so stale results go at
      // once and cannot be clicked between keystrokes. A session query takes a
      // round trip: its panel keeps the listed results, saying it is searching,
      // until the answer replaces them — none of them highlighted meanwhile.
      if (!enabled) {
        setResults([])
        setIsOpen(false)
      }
      debounce.schedule(() => {
        void runSearch(nextQuery)
      })
    },
    [runSearch, setQuery, setResults, setIsOpen, setActive, debounce, enabled, abort]
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

export function usePageSearch(source: PageSearchSource): PageSearchController {
  const state = useSearchState()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const debounce = useDebounce()

  const queryAbort = useQueryAbort()
  const runSearch = useRunSearch(state, source, queryAbort)
  const onChange = useChangeHandler(state, runSearch, debounce, {
    enabled: source.sessionIndex,
    abort: queryAbort,
  })
  const { cancel } = debounce
  const stopQuery = useCallback(() => {
    cancel()
    queryAbort.abort()
  }, [cancel, queryAbort])
  const onKeyDown = useKeyDownHandler(state, stopQuery)
  useLifecycleEffects(state.isOpen, state.setIsOpen, containerRef)

  return {
    query: state.query,
    results: state.results,
    isOpen: state.isOpen,
    pending: state.pending,
    active: state.active,
    containerRef,
    onChange,
    onKeyDown,
    onNavigate: navigateTo,
  }
}
