/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/immutable-data -- a ref's `.current` IS the mutable cell React gives a component for values that must survive a render without causing one; every write below is one of those. */

import { useCallback, useEffect, useRef, useState } from 'react'

/** What the thread needs to page itself as the reader scrolls. */
export interface ScrollFetchedPages {
  /** Offset of the page currently being requested. */
  readonly offset: number
  /** Jump to an explicit offset — the numbered pager's entry point. */
  readonly goToOffset: (offset: number) => void
  /** Return to the first page, forgetting every page already asked for. */
  readonly restart: () => void
  /** Attach to the element that marks the end of the list. */
  readonly sentinelRef: (node: HTMLElement | null) => void
}

/**
 * Page a list forward as a sentinel element reaches the viewport.
 *
 * Reaching the end of what has loaded IS the request for more, so there is no
 * control to press. Two properties make that safe, and both are easier to get
 * wrong than to state:
 *
 * ONE PAGE PER GESTURE. An `IntersectionObserver` notifies on a CROSSING, not
 * on a condition: a sentinel that enters the viewport and stays there produces
 * exactly one notification, so rows appended beneath a still-visible sentinel
 * do not ask for another page. That holds only while the sentinel keeps its
 * identity across the append — which is why the caller renders it in a fixed
 * position of its tree rather than rebuilding it around each page.
 *
 * AND NEVER THE SAME PAGE TWICE. Two crossings can still arrive before a state
 * update commits — a flick that leaves and re-enters is enough — and both would
 * read the same stale offset from their render's closure. The watermark below
 * is decidable at the moment of the call, where a render-scoped value is not.
 * Requesting one page twice and appending it twice is the classic defect of
 * every scroll-fetched list.
 *
 * The caller stops the whole mechanism by not rendering the sentinel: the ref
 * callback receives `null`, the observer is disconnected, and "there is nothing
 * left to load" and "nothing is being observed" become one state rather than
 * two that have to agree.
 */
export function useScrollFetch(limit: number): ScrollFetchedPages {
  const [offset, setOffset] = useState(0)
  const watermark = useRef(0)
  const current = useRef(0)
  useEffect(() => {
    current.current = offset
  }, [offset])

  const advance = useCallback((): void => {
    const next = current.current + limit
    if (watermark.current >= next) return
    watermark.current = next
    setOffset(next)
  }, [limit])

  const goToOffset = useCallback((next: number): void => {
    watermark.current = Math.max(watermark.current, next)
    setOffset(next)
  }, [])

  const restart = useCallback((): void => {
    watermark.current = 0
    setOffset(0)
  }, [])

  // The handler is read through a ref so the observer survives every render
  // without being rebuilt. Rebuilding it would re-deliver an initial
  // notification for a sentinel that is already visible — the crossing
  // semantics above turned into a fetch loop.
  const handler = useRef(advance)
  useEffect(() => {
    handler.current = advance
  }, [advance])

  const observer = useRef<IntersectionObserver | undefined>(undefined)
  useEffect(() => () => observer.current?.disconnect(), [])

  const sentinelRef = useCallback((node: HTMLElement | null): void => {
    observer.current?.disconnect()
    observer.current = undefined
    // `IntersectionObserver` is absent under SSR and in a DOM-less unit
    // environment; an unobserved sentinel simply never fires, rather than
    // throwing on mount.
    if (node === null || typeof IntersectionObserver === 'undefined') return
    const next = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) handler.current()
    })
    next.observe(node)
    observer.current = next
  }, [])

  return { offset, goToOffset, restart, sentinelRef }
}
