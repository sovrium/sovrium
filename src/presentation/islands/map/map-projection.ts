/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a pin goes: Web Mercator, the projection every slippy-map tile server
 * draws in, so pins and an operator's tiles line up. Dependency-free on
 * purpose — a pin layer is a few lines of arithmetic, and a mapping library
 * would cost the island an order of magnitude more than the drawing.
 */

export interface LatLng {
  readonly lat: number
  readonly lng: number
}

export interface MapView {
  readonly center: LatLng
  readonly zoom: number
}

/** One tile's pixel size, the slippy-map convention. */
export const TILE = 256
const MAX_LAT = 85.0511

const finite = (value: unknown): number | undefined => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : undefined
}

/**
 * A geolocation value as the API answers it: `{ lat, lng }`, `{ x, y }`, or a
 * `"(lat,lng)"` / `"lat,lng"` string. `undefined` for an empty or unreadable one.
 */
export function readLatLng(value: unknown): LatLng | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'string') return latLngOfText(value)
  return typeof value === 'object' ? latLngOfObject(value as Record<string, unknown>) : undefined
}

const pair = (lat: number | undefined, lng: number | undefined): LatLng | undefined =>
  lat === undefined || lng === undefined ? undefined : { lat, lng }

function latLngOfText(value: string): LatLng | undefined {
  const [lat, lng] = value
    .replace(/[()\s]/g, '')
    .split(',')
    .map(finite)
  return pair(lat, lng)
}

const latLngOfObject = (record: Record<string, unknown>): LatLng | undefined =>
  pair(finite(record['lat'] ?? record['x']), finite(record['lng'] ?? record['y']))

/** World pixel coordinates of a point at a zoom level. */
export function project(point: LatLng, zoom: number): { readonly x: number; readonly y: number } {
  const size = TILE * 2 ** zoom
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, point.lat))
  const sin = Math.sin((lat * Math.PI) / 180)
  return {
    x: ((point.lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  }
}

/** The view that fits every point inside `width` × `height` with a margin. */
export function fitView(points: readonly LatLng[], width: number, height: number): MapView {
  if (points.length === 0) return { center: { lat: 20, lng: 0 }, zoom: 1 }
  const lats = points.map((point) => point.lat)
  const lngs = points.map((point) => point.lng)
  const center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  }
  const fits = (zoom: number): boolean => {
    const projected = points.map((point) => project(point, zoom))
    const spanX = Math.max(...projected.map((p) => p.x)) - Math.min(...projected.map((p) => p.x))
    const spanY = Math.max(...projected.map((p) => p.y)) - Math.min(...projected.map((p) => p.y))
    return spanX <= width * 0.8 && spanY <= height * 0.8
  }
  const zooms = Array.from({ length: 17 }, (_unused, index) => 16 - index)
  return { center, zoom: points.length === 1 ? 12 : (zooms.find(fits) ?? 0) }
}

/** A point's position inside a `width` × `height` frame showing `view`. */
export function toFrame(
  point: LatLng,
  view: MapView,
  frame: { readonly width: number; readonly height: number }
): { readonly x: number; readonly y: number } {
  const at = project(point, view.zoom)
  const middle = project(view.center, view.zoom)
  return { x: at.x - middle.x + frame.width / 2, y: at.y - middle.y + frame.height / 2 }
}

/** One marker: a single record's pin, or a cluster of several. */
export interface Marker<T> {
  readonly x: number
  readonly y: number
  readonly items: readonly T[]
}

/** Group placed items lying within `radius` pixels of a marker already made. */
export function clusterMarkers<T>(
  placed: readonly { readonly x: number; readonly y: number; readonly item: T }[],
  radius: number
): readonly Marker<T>[] {
  return placed.reduce<readonly Marker<T>[]>((markers, entry) => {
    const near = markers.findIndex(
      (marker) => Math.hypot(marker.x - entry.x, marker.y - entry.y) <= radius
    )
    if (near === -1) return [...markers, { x: entry.x, y: entry.y, items: [entry.item] }]
    return markers.map((marker, index) =>
      index === near ? { ...marker, items: [...marker.items, entry.item] } : marker
    )
  }, [])
}

/** The tiles covering a frame, as `{ url, left, top }` from a `{z}/{x}/{y}` template. */
export function tilesFor(
  template: string,
  view: MapView,
  frame: { readonly width: number; readonly height: number }
): readonly { readonly url: string; readonly left: number; readonly top: number }[] {
  const middle = project(view.center, view.zoom)
  const originX = middle.x - frame.width / 2
  const originY = middle.y - frame.height / 2
  const count = 2 ** view.zoom
  const range = (from: number, to: number): readonly number[] =>
    Array.from({ length: Math.max(0, to - from + 1) }, (_unused, index) => from + index)
  const xs = range(Math.floor(originX / TILE), Math.floor((originX + frame.width) / TILE))
  const ys = range(Math.floor(originY / TILE), Math.floor((originY + frame.height) / TILE))
  return ys
    .filter((y) => y >= 0 && y < count)
    .flatMap((y) =>
      xs.map((x) => ({
        url: template
          .replace('{z}', String(view.zoom))
          .replace('{x}', String(((x % count) + count) % count))
          .replace('{y}', String(y)),
        left: x * TILE - originX,
        top: y * TILE - originY,
      }))
    )
}
