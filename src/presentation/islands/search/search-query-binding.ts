/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Query-binding helpers for the `search-list` island.
 *
 * Two query sources feed the same applied-query state:
 *
 * 1. **Bound** — `dataSource.bindTo` names an external `searchInput` component.
 *    That input is static SSR markup which publishes its value via DOM `input`
 *    events. The per-publisher query controls (`debounceMs`, `minQueryLength`)
 *    are declared on the searchInput schema and stamped by its renderer onto
 *    the inner `<input>` as `data-search-debounce` / `data-search-min-length`;
 *    {@link readSearchInputConfig} reads them back off the DOM at bind time.
 *    Keeping the attribute names behind that ONE function means a second
 *    subscriber can reuse the contract without re-deriving them.
 *
 * 2. **Unbound** — the island renders its own `SearchBox`, whose delay is the
 *    list's own `dataSource.debounceMs`, handed down as a prop rather than read
 *    off the DOM: there is no publisher to read it from.
 *    {@link useUnboundQuery} owns that path.
 *
 * Both paths share {@link useDebouncedDispatch}, so "debounced" means the same
 * thing on either side of the split. A delay of `0` applies synchronously with
 * no timer at all. That is not an optimisation — several green specs type and
 * assert without waiting, so even a zero-length `setTimeout` would defer the
 * update by a macrotask tick.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

/** Per-publisher query controls, as declared on a `searchInput` component. */
export interface SearchInputConfig {
  readonly debounceMs: number
  readonly minQueryLength: number
}

/** Both attributes absent means "no delay, no minimum" — the documented defaults. */
const ZERO_CONFIG: SearchInputConfig = { debounceMs: 0, minQueryLength: 0 }

function parseNonNegativeInt(raw: string | null): number {
  if (raw === null) return 0
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/**
 * Reads a publisher `searchInput`'s query controls off its DOM attributes.
 *
 * The single place that knows the attribute names. An absent attribute means
 * the author never declared the field, so the reader supplies the default —
 * the renderer deliberately emits nothing rather than a phantom fallback.
 */
export function readSearchInputConfig(input: Element | null | undefined): SearchInputConfig {
  if (!input) return ZERO_CONFIG
  return {
    debounceMs: parseNonNegativeInt(input.getAttribute('data-search-debounce')),
    minQueryLength: parseNonNegativeInt(input.getAttribute('data-search-min-length')),
  }
}

/**
 * Gates a raw query against the publisher's minimum length.
 *
 * Below the minimum the applied query collapses to `''` — the subscriber's
 * unfiltered baseline. An already-empty query is never gated: clearing the box
 * must always restore the baseline rather than freeze the last applied filter.
 */
export function applyMinQueryLength(value: string, minQueryLength: number): string {
  return value.length > 0 && value.length < minQueryLength ? '' : value
}

/** Resolves the `<input>` inside the publisher component named by `bindTo`. */
export function resolveBoundInput(bindTo: string): HTMLInputElement | undefined {
  const container = document.getElementById(bindTo)
  const input =
    container?.querySelector('input') ??
    document.querySelector<HTMLInputElement>(`#${bindTo} input`)
  return input ?? undefined
}

interface DebouncedDispatch {
  /** Runs `run` after `delayMs`, superseding any pending call. `0` runs now. */
  readonly dispatch: (delayMs: number, run: () => void) => void
  readonly cancel: () => void
}

/**
 * Encapsulates the debounce timer ref so callers never pass refs around.
 * Mirrors `useDebounce` in `page-search/use-page-search.ts`, with the delay
 * supplied per call rather than at hook setup: the bound path only learns it
 * once the publisher is resolved, so a setup-time delay would fit neither
 * caller.
 */
function useDebouncedDispatch(): DebouncedDispatch {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    // eslint-disable-next-line functional/immutable-data -- ref holds the debounce timer
    timerRef.current = undefined
  }, [])

  const dispatch = useCallback(
    (delayMs: number, run: () => void) => {
      cancel()
      if (delayMs <= 0) {
        run()
        return
      }
      // eslint-disable-next-line functional/immutable-data -- ref holds the debounce timer
      timerRef.current = setTimeout(run, delayMs)
    },
    [cancel]
  )

  useEffect(() => cancel, [cancel])
  return { dispatch, cancel }
}

/**
 * Subscribes to an external `searchInput`'s value when `bindTo` is set,
 * applying that publisher's declared debounce and minimum-length gate.
 *
 * The config is read once at bind time: the attributes are static SSR markup,
 * so re-reading them per keystroke would buy nothing.
 */
export function useBoundQuery(bindTo: string | undefined, setQuery: (value: string) => void): void {
  const { dispatch, cancel } = useDebouncedDispatch()

  useEffect(() => {
    if (!bindTo) return undefined
    const input = resolveBoundInput(bindTo)
    if (!input) return undefined

    const { debounceMs, minQueryLength } = readSearchInputConfig(input)
    const onInput = (e: Event) => {
      const gated = applyMinQueryLength((e.target as HTMLInputElement).value, minQueryLength)
      dispatch(debounceMs, () => setQuery(gated))
    }

    input.addEventListener('input', onInput)
    return () => {
      cancel()
      input.removeEventListener('input', onInput)
    }
  }, [bindTo, setQuery, dispatch, cancel])
}

/** Wiring for the island's own `SearchBox`: the typed value and its handler. */
export interface UnboundQuery {
  /** What the user typed. Feeds the controlled `<input>` with no delay. */
  readonly value: string
  readonly onChange: (e: ChangeEvent<HTMLInputElement>) => void
}

/**
 * Drives the island's own `SearchBox`, delaying only the APPLIED query.
 *
 * The typed value and the applied one are separate state on purpose: the box
 * must echo every keystroke immediately, while `filterRecords` should only see
 * the query once typing pauses. `SearchToolbar` in the data-table island makes
 * the same split for the same reason.
 *
 * `debounceMs` here is the list's own `dataSource.debounceMs`. That is the only
 * difference from {@link useBoundQuery}, which reads its delay off the
 * publisher's DOM attributes — same debounce, different declaration site.
 *
 * There is deliberately no `minQueryLength` counterpart: that control is
 * declared on `searchInput`, and `dataSource` has no such field, so an unbound
 * box has no minimum to enforce.
 */
export function useUnboundQuery(
  debounceMs: number,
  setQuery: (value: string) => void
): UnboundQuery {
  const { dispatch } = useDebouncedDispatch()
  const [value, setValue] = useState('')

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const typed = e.target.value
      setValue(typed)
      dispatch(debounceMs, () => setQuery(typed))
    },
    [debounceMs, dispatch, setQuery]
  )

  return { value, onChange }
}
