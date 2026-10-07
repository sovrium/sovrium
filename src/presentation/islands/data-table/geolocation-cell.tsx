/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeGeolocationClasses,
  computeGeolocationCoordClasses,
  computeGeolocationPinClasses,
} from '../../design/cell-affordances-default-classes'
import { EMPTY_VALUE, isMissing } from './cell-empty'

// ──────────────────────────────────────────────────────────────────────────────
// GEOLOCATION (pin + lat,lng)
// ──────────────────────────────────────────────────────────────────────────────

interface LatLng {
  readonly lat: number
  readonly lng: number
}

const parseObjectGeoloc = (obj: Record<string, unknown>): LatLng | undefined => {
  const lat = typeof obj['lat'] === 'number' ? obj['lat'] : Number(obj['lat'])
  const lng = typeof obj['lng'] === 'number' ? obj['lng'] : Number(obj['lng'])
  if (Number.isNaN(lat) || Number.isNaN(lng)) return undefined
  return { lat, lng }
}

const parseStringGeoloc = (s: string): LatLng | undefined => {
  const parts = s.split(',').map((p) => Number(p.trim()))
  if (parts.length !== 2) return undefined
  const [lat, lng] = parts
  if (lat === undefined || lng === undefined) return undefined
  if (Number.isNaN(lat) || Number.isNaN(lng)) return undefined
  return { lat, lng }
}

const parseGeoloc = (value: unknown): LatLng | undefined => {
  if (isMissing(value)) return undefined
  if (typeof value === 'object') return parseObjectGeoloc(value as Record<string, unknown>)
  if (typeof value === 'string') return parseStringGeoloc(value)
  return undefined
}

/**
 * Render a geolocation cell as a bordered chip: pin glyph + "lat, lng" pair
 * formatted to 4 decimals in mono / tabular-nums so a column of coords
 * aligns at the decimal point.
 */
export function GeolocationCell({ value }: { value: unknown }): React.ReactNode {
  const coords = parseGeoloc(value)
  if (!coords) return EMPTY_VALUE
  return (
    <span className={computeGeolocationClasses()}>
      <span
        aria-hidden="true"
        className={computeGeolocationPinClasses()}
      >
        ◉
      </span>
      <span className={computeGeolocationCoordClasses()}>
        {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
      </span>
    </span>
  )
}
