/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The map frame's measured width and the view it shows: the authored
 * `center` + `zoom`, else fitted to the pins, then moved by the zoom controls
 * and by a cluster opened in place.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { fitView, type LatLng, type MapView } from './map-projection'

export function useFrameWidth(): {
  readonly ref: React.RefObject<HTMLDivElement | null>
  readonly width: number
} {
  const ref = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const node = ref.current
    if (node === null) return undefined
    setWidth(node.clientWidth)
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

export function useMapView(input: {
  readonly points: readonly LatLng[]
  readonly width: number
  readonly height: number
  readonly center?: LatLng
  readonly zoom?: number
}): {
  readonly view: MapView
  readonly setView: (view: MapView) => void
} {
  const { points, width, height, center, zoom } = input
  const initial = useMemo(
    () =>
      center !== undefined && zoom !== undefined
        ? { center, zoom }
        : fitView(points, Math.max(width, 1), height),
    [points, width, height, center, zoom]
  )
  const [moved, setView] = useState<MapView | undefined>(undefined)
  return { view: moved ?? initial, setView }
}
