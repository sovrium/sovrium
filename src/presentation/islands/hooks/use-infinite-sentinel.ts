/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef } from 'react'

interface InfiniteSentinelOptions {
  /** More rows exist past the ones held. */
  readonly hasMore: boolean
  /** The next page is already in flight: a second request would fetch it twice. */
  readonly isLoading: boolean
  /** Asks for the next page, through the same continuation a Load more press uses. */
  readonly onLoadMore: () => void
  /**
   * Changes whenever the list grows: a list that reveals pages without a
   * request (a board, a gallery) never reports `isLoading`, so this is what
   * tells the marker a page has landed.
   */
  readonly loadedKey?: string
}

/**
 * The `ref` of an infinite list's end marker: when the marker scrolls into view
 * and more rows exist, the next page is asked for.
 *
 * The observer reads the latest `hasMore` / `isLoading` / `onLoadMore` through a
 * ref, so a page arriving never re-creates it. When a page lands the marker is
 * observed afresh: the observer's first report is measured after the new rows
 * are laid out, so a marker still in view (a page shorter than the viewport)
 * asks for the next one, and a marker the new rows pushed away does not.
 *
 * Nothing is fetched before the reader has scrolled: a list whose first page
 * already fits on screen shows that page, and its Load more control, rather
 * than fetching pages nobody asked for.
 *
 * Driving the SAME continuation as a Load more press is the point: that offset
 * continuation is keyed by everything that decides the rows listed (sort,
 * filter, search, page size), so a change of any of them starts again from the
 * first page by construction.
 */
export function useInfiniteSentinel({
  hasMore,
  isLoading,
  onLoadMore,
  loadedKey,
}: InfiniteSentinelOptions): (node: HTMLElement | null) => void {
  const latest = useRef({ hasMore, isLoading, onLoadMore })
  useEffect(() => {
    latest.current = { hasMore, isLoading, onLoadMore }
  }, [hasMore, isLoading, onLoadMore])
  const observer = useRef<IntersectionObserver | undefined>(undefined)
  const marker = useRef<HTMLElement | null>(null)

  // A page landed: measure the marker again, against the rows as they are now.
  useEffect(() => {
    const node = marker.current
    if (isLoading || node === null || observer.current === undefined) return
    observer.current.unobserve(node)
    observer.current.observe(node)
  }, [isLoading, loadedKey])

  useEffect(() => () => observer.current?.disconnect(), [])

  // The reader has scrolled something since the list mounted.
  const scrolled = useRef(false)
  useEffect(() => {
    const onScroll = () => {
      scrolled.current = true
      const node = marker.current
      if (node === null || observer.current === undefined) return
      // Measure again now that the reader has moved: a marker already in view
      // asks for its page on the first scroll.
      observer.current.unobserve(node)
      observer.current.observe(node)
    }
    window.addEventListener('scroll', onScroll, { capture: true, passive: true, once: true })
    return () => window.removeEventListener('scroll', onScroll, { capture: true })
  }, [])

  return useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect()
    marker.current = node
    if (node === null || typeof IntersectionObserver === 'undefined') return
    observer.current = new IntersectionObserver((entries) => {
      const { hasMore: more, isLoading: loading, onLoadMore: load } = latest.current
      if (!scrolled.current || !more || loading) return
      if (entries.some((entry) => entry.isIntersecting)) load()
    })
    observer.current.observe(node)
  }, [])
}
