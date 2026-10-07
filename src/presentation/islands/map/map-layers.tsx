/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the map frame draws, back to front: the basemap (the operator's tiles,
 * or a neutral grid), then the markers. Every marker is `aria-hidden` and out
 * of the tab order — the list twin is the keyboard's and the screen reader's
 * way to the same records, in the same order, so a pin is a pointer shortcut
 * and never a second, unnamed copy of a twin button.
 */

import { useMemo, type ReactElement } from 'react'
import { tilesFor, type MapView, type Marker } from './map-projection'
import type { MapItem } from './map-types'

export interface Frame {
  readonly width: number
  readonly height: number
}

/** The neutral basemap: a hairline grid in the border role, no request anywhere. */
const GRID_STYLE = {
  backgroundImage:
    'linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)',
  backgroundSize: '40px 40px',
} as const

function TileImage({
  url,
  left,
  top,
}: {
  readonly url: string
  readonly left: number
  readonly top: number
}): ReactElement {
  const at = useMemo(() => ({ left, top }), [left, top])
  return (
    <img
      src={url}
      alt=""
      width={256}
      height={256}
      className="absolute max-w-none"
      style={at}
    />
  )
}

export function Basemap({
  tiles,
  view,
  frame,
}: {
  readonly tiles: string | undefined
  readonly view: MapView
  readonly frame: Frame
}): ReactElement {
  if (tiles === undefined) {
    return (
      <div
        aria-hidden="true"
        data-map-basemap="grid"
        className="bg-muted/40 absolute inset-0"
        style={GRID_STYLE}
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      data-map-basemap="tiles"
      className="absolute inset-0 overflow-hidden"
    >
      {tilesFor(tiles, view, frame).map((tile) => (
        <TileImage
          key={tile.url}
          {...tile}
        />
      ))}
    </div>
  )
}

const PIN =
  'absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-sm'
const CLUSTER =
  'absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background font-mono text-xs'

/** One marker: a record's pin in its colour, or a cluster carrying its count. */
function MarkerButton({
  marker,
  onPin,
  onCluster,
}: {
  readonly marker: Marker<MapItem>
  readonly onPin: (item: MapItem) => void
  readonly onCluster: (marker: Marker<MapItem>) => void
}): ReactElement | null {
  const [first] = marker.items
  const single = marker.items.length === 1
  const color = single ? first?.color : undefined
  const at = useMemo(
    () => ({
      left: marker.x,
      top: marker.y,
      ...(color !== undefined && { backgroundColor: color }),
    }),
    [marker.x, marker.y, color]
  )
  if (first === undefined) return null
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      {...(single ? { 'data-map-pin': first.id } : { 'data-map-cluster': marker.items.length })}
      className={single ? `${PIN} ${color === undefined ? 'bg-foreground' : ''}` : CLUSTER}
      style={at}
      onClick={() => (single ? onPin(first) : onCluster(marker))}
    >
      {single ? null : marker.items.length}
    </button>
  )
}

export function Markers({
  markers,
  onPin,
  onCluster,
}: {
  readonly markers: readonly Marker<MapItem>[]
  readonly onPin: (item: MapItem) => void
  readonly onCluster: (marker: Marker<MapItem>) => void
}): ReactElement {
  return (
    <>
      {markers.map((marker) => (
        <MarkerButton
          key={marker.items.map((item) => item.id).join('-')}
          marker={marker}
          onPin={onPin}
          onCluster={onCluster}
        />
      ))}
    </>
  )
}
