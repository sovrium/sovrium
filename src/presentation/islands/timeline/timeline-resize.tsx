/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Drag-to-resize on a timeline bar.
 *
 * A handle sits at each end of a bar whose date its reader may write — the
 * server names those fields (`resizeFields`) from the table's update grant and
 * the field's write rule, so a reader without them is drawn no handle at all,
 * and a system-source timeline is never given any. A released handle commits
 * a whole number of days (`timeline-resize-compute.ts`) through ONE records-API
 * update, so the usual permission, field rules, automations and webhooks
 * apply. The bar repaints at the saved day at once; a refused write puts it
 * back.
 */

import { useCallback, useContext } from 'react'
import { computeTimelineSpanDays, type TimelineBounds, type TimelineItem } from './timeline-compute'
import { snappedDays, type ResizeEdge } from './timeline-resize-compute'
import { TimelineResizeContext, type TimelineResize } from './use-timeline-resize'
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react'

const HANDLE_BASE = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 8,
  cursor: 'ew-resize',
  touchAction: 'none',
} as const
const HANDLE_STYLE: Readonly<Record<ResizeEdge, Readonly<Record<string, unknown>>>> = {
  start: { ...HANDLE_BASE, left: 0 },
  end: { ...HANDLE_BASE, right: 0 },
}

/** One end's grip: drags its bar's edge, and commits the snapped days on release. */
function ResizeHandle({
  item,
  edge,
  resize,
  spanDays,
}: {
  readonly item: TimelineItem
  readonly edge: ResizeEdge
  readonly resize: TimelineResize
  readonly spanDays: number
}): ReactElement {
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLSpanElement>) => {
      const handle = event.currentTarget
      const bar = handle.parentElement
      const track = bar?.offsetParent as HTMLElement | null | undefined
      if (bar === null || !track) return
      event.preventDefault()
      event.stopPropagation()
      handle.setPointerCapture(event.pointerId)
      const originX = event.clientX
      const pxPerDay = track.getBoundingClientRect().width / spanDays
      const { left, width } = bar.style
      // The bar follows the pointer while it is held; the snap happens on release.
      const move = (e: PointerEvent): void => {
        const dx = e.clientX - originX
        const grow = edge === 'end' ? dx : -dx
        bar.style.width = `calc(${width} + ${String(grow)}px)`
        if (edge === 'start') bar.style.left = `calc(${left} + ${String(dx)}px)`
      }
      const release = (e: PointerEvent): void => {
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', release)
        handle.removeEventListener('pointercancel', release)
        Object.assign(bar.style, { left, width })
        if (e.type === 'pointerup')
          resize.commit(item, edge, snappedDays(e.clientX - originX, pxPerDay))
      }
      handle.addEventListener('pointermove', move)
      handle.addEventListener('pointerup', release)
      handle.addEventListener('pointercancel', release)
    },
    [item, edge, resize, spanDays]
  )
  return (
    <span
      data-timeline-resize-handle={edge}
      aria-hidden="true"
      style={HANDLE_STYLE[edge]}
      onPointerDown={onPointerDown}
    />
  )
}

/** The handles a bar carries for its reader — none when she may move neither date. */
export function TimelineResizeHandles({
  item,
  bounds,
}: {
  readonly item: TimelineItem
  readonly bounds: TimelineBounds
}): ReactElement | null {
  const resize = useContext(TimelineResizeContext)
  if (resize === undefined || item.kind !== 'bar') return null
  const spanDays = computeTimelineSpanDays(bounds)
  return (
    <>
      {resize.edges.map((edge) => (
        <ResizeHandle
          key={edge}
          item={item}
          edge={edge}
          resize={resize}
          spanDays={spanDays}
        />
      ))}
    </>
  )
}
