/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `map` island — the records of a table drawn as pins at their location.
 *
 * Rows come from the records API (through the bound view when there is one).
 * The frame draws the operator's tiles when `MAP_TILES_URL` is set, and
 * otherwise a neutral grid that requests nothing. Beside it the list twin
 * lists EVERY record, the unlocated ones included, each a button opening the
 * same card a pin opens; it is the map's keyboard and screen-reader path, so
 * the pins themselves stay out of both.
 */

import { useMemo, useState, type ReactElement } from 'react'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { useRecordsQuery, type RecordsDataSource } from '../hooks/use-records-query'
import { cardPathClick, openCardDrawer } from '../runtime/card-click'
import { MapCard } from './map-card'
import { Basemap, Markers } from './map-layers'
import { clusterMarkers, readLatLng, toFrame, type LatLng } from './map-projection'
import { useFrameWidth, useMapView } from './use-map-frame'
import type { MapItem, PinClick } from './map-types'
import type { TableRecord } from '../runtime/types'

interface MapIslandProps {
  readonly dataSource?: RecordsDataSource
  readonly locationField: string
  readonly labelField: string
  readonly colorField?: string
  /** Option value -> fill, painted server-side from the field's declared options. */
  readonly colors?: Readonly<Record<string, string>>
  readonly onPinClick?: PinClick
  readonly cluster?: boolean
  readonly center?: LatLng
  readonly zoom?: number
  readonly height?: number
  readonly emptyMessage?: string
  readonly tiles?: { readonly url?: string; readonly attribution?: string }
}

const CONTROL = 'border-border bg-background flex size-8 items-center justify-center border text-sm'

function itemsOf(rows: readonly TableRecord[], props: MapIslandProps): readonly MapItem[] {
  return rows.map((record) => {
    const at = readLatLng(record[props.locationField])
    const color =
      props.colorField === undefined ? undefined : props.colors?.[String(record[props.colorField])]
    return {
      id: String(record.id),
      label: String(record[props.labelField] ?? `#${String(record.id)}`),
      ...(at !== undefined && { at }),
      ...(color !== undefined && { color }),
      record,
    }
  })
}

/** Run the card's Open: the drawer, or the record's own page. */
function openItem(click: PinClick | undefined, item: MapItem, table: string | undefined): void {
  if (click === undefined) return
  if ('action' in click) openCardDrawer(click.component, item.record, table)
  else cardPathClick(substituteRecordVars(click.path, item.record))?.()
}

/** The zoom controls, the keyboard's way to change the scale. */
function ZoomControls({ onZoom }: { readonly onZoom: (step: number) => void }): ReactElement {
  return (
    <div className="absolute bottom-3 left-3 flex flex-col">
      <button
        type="button"
        aria-label="Zoom in"
        className={CONTROL}
        onClick={() => onZoom(1)}
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        className={CONTROL}
        onClick={() => onZoom(-1)}
      >
        −
      </button>
    </div>
  )
}

/** The corner line naming the tiles' source, or saying there are none. */
const attributionOf = (tiles: MapIslandProps['tiles']): string =>
  tiles?.url === undefined ? 'No map tiles configured' : (tiles.attribution ?? 'Map tiles')

/** Everything the map draws, derived from the rows, the frame and the view. */
function useMapModel(props: MapIslandProps) {
  const query = useRecordsQuery('map', props.dataSource)
  const rows = query.data?.records
  const items = useMemo(() => itemsOf(rows ?? [], props), [rows, props])
  const located = useMemo(() => items.filter((item) => item.at !== undefined), [items])
  const points = useMemo(() => located.map((item) => item.at as LatLng), [located])
  const height = props.height ?? 400
  const { ref, width } = useFrameWidth()
  const { view, setView } = useMapView({
    points,
    width,
    height,
    center: props.center,
    zoom: props.zoom,
  })
  const frameStyle = useMemo(() => ({ height }), [height])
  const frame = { width, height }
  const placed = located.map((item) => ({ ...toFrame(item.at as LatLng, view, frame), item }))
  return {
    pending: query.isPending,
    items,
    markers: clusterMarkers(placed, props.cluster === false ? 0 : 24),
    ref,
    frame,
    frameStyle,
    view,
    zoomBy: (step: number): void =>
      setView({ ...view, zoom: Math.max(0, Math.min(20, view.zoom + step)) }),
  }
}

/** Close the card and give focus back to the twin entry that opened it. */
function closeCard(openId: string | undefined, setOpenId: (id: string | undefined) => void): void {
  setOpenId(undefined)
  if (openId === undefined) return
  document.querySelector<HTMLElement>(`[data-map-twin="${CSS.escape(openId)}"]`)?.focus()
}

export default function MapIsland(props: MapIslandProps): ReactElement {
  const model = useMapModel(props)
  const [openId, setOpenId] = useState<string | undefined>(undefined)
  const open = model.items.find((item) => item.id === openId)
  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <div
        ref={model.ref}
        className="border-border relative min-w-0 flex-1 overflow-hidden rounded-md border"
        style={model.frameStyle}
      >
        <Basemap
          tiles={props.tiles?.url}
          view={model.view}
          frame={model.frame}
        />
        {model.frame.width > 0 && (
          <Markers
            markers={model.markers}
            onPin={(item) => setOpenId(item.id)}
            onCluster={(marker) => setOpenId(marker.items[0]?.id)}
          />
        )}
        <ZoomControls onZoom={model.zoomBy} />
        <p className="bg-background/80 text-muted-foreground absolute right-0 bottom-0 px-2 py-0.5 text-[11px]">
          {attributionOf(props.tiles)}
        </p>
        {open !== undefined && (
          <MapCard
            item={open}
            canOpen={props.onPinClick !== undefined}
            onOpen={() => openItem(props.onPinClick, open, props.dataSource?.table)}
            onClose={() => closeCard(openId, setOpenId)}
          />
        )}
      </div>
      <MapTwin
        items={model.items}
        empty={model.pending ? undefined : (props.emptyMessage ?? 'No locations to show.')}
        onChoose={setOpenId}
      />
    </div>
  )
}

/** The list twin: every record, in pin order, each a button opening its card. */
function MapTwin({
  items,
  empty,
  onChoose,
}: {
  readonly items: readonly MapItem[]
  readonly empty: string | undefined
  readonly onChoose: (id: string) => void
}): ReactElement {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm md:w-56">{empty ?? 'Loading…'}</p>
  }
  return (
    <ul
      aria-label="Locations"
      className="flex flex-col gap-1 md:w-56"
    >
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            data-map-twin={item.id}
            onClick={() => onChoose(item.id)}
            className="hover:bg-muted w-full rounded-sm px-2 py-1 text-left text-sm"
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  )
}
