/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

export interface SearchInputConfig {
  readonly debounceMs: number
  readonly minQueryLength: number
}

const ZERO_CONFIG: SearchInputConfig = { debounceMs: 0, minQueryLength: 0 }

function parseNonNegativeInt(raw: string | null): number {
  if (raw === null) return 0
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function readSearchInputConfig(input: Element | null | undefined): SearchInputConfig {
  if (!input) return ZERO_CONFIG
  return {
    debounceMs: parseNonNegativeInt(input.getAttribute('data-search-debounce')),
    minQueryLength: parseNonNegativeInt(input.getAttribute('data-search-min-length')),
  }
}

export function applyMinQueryLength(value: string, minQueryLength: number): string {
  return value.length > 0 && value.length < minQueryLength ? '' : value
}

export function resolveBoundInput(bindTo: string): HTMLInputElement | undefined {
  const container = document.getElementById(bindTo)
  const input =
    container?.querySelector('input') ??
    document.querySelector<HTMLInputElement>(`#${bindTo} input`)
  return input ?? undefined
}

interface DebouncedDispatch {
  readonly dispatch: (delayMs: number, run: () => void) => void
  readonly cancel: () => void
}

function useDebouncedDispatch(): DebouncedDispatch {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = undefined
  }, [])

  const dispatch = useCallback(
    (delayMs: number, run: () => void) => {
      cancel()
      if (delayMs <= 0) {
        run()
        return
      }
      timerRef.current = setTimeout(run, delayMs)
    },
    [cancel]
  )

  useEffect(() => cancel, [cancel])
  return { dispatch, cancel }
}

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

export interface UnboundQuery {
  readonly value: string
  readonly onChange: (e: ChangeEvent<HTMLInputElement>) => void
}

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
