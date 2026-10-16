/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { holdContribution } from './shared-filter-held'
import type { PublisherWire } from '@/domain/models/app/pages/shared-filter-wire-service'

/** Re-exported so a publisher loading this module on demand gets the whole wire from it. */
export { publisherWire } from '@/domain/models/app/pages/shared-filter-wire-service'

/**
 * Send a control's value on its channel: the event every subscriber listens
 * to, the late-join record, and — when the declaration opted in — the page
 * address.
 *
 * Reuses the `island:system-query` event rather than minting a second bus:
 * every subscriber already listens to it.
 */
const SHARED_FILTER_EVENT = 'island:system-query'

/** One value as the channel carries it: a list comma-joined, nothing as ''. */
const asText = (value: unknown): string => {
  if (Array.isArray(value)) return value.map((one) => String(one ?? '')).join(',')
  return value === null || value === undefined ? '' : String(value)
}

/**
 * The string each key of `wire` carries for `value`.
 *
 * A period (two keys) takes `[from, to]`; a switch or a toggle publishes its
 * declared value while on and withdraws it when off; anything else publishes
 * its value, a list comma-joined.
 */
export function wireValues(wire: PublisherWire, value: unknown): Record<string, string> {
  const ends = Array.isArray(value) ? value : [undefined, undefined]
  const texts =
    wire.keys.length === 2
      ? [asText(ends[0]), asText(ends[1])]
      : [
          typeof value === 'boolean' && wire.onValue !== undefined
            ? value
              ? wire.onValue
              : ''
            : asText(value),
        ]
  return Object.fromEntries(wire.keys.map((key, index) => [key.bagKey, texts[index] ?? '']))
}

/**
 * Mirror the contribution in the address with `history.replaceState`: written
 * in place, so the page is not navigated and nothing else reloads. An empty
 * value takes its key out.
 */
function mirrorInAddress(wire: PublisherWire, params: Readonly<Record<string, string>>): void {
  const mirrored = wire.keys.filter((key) => key.urlKey !== undefined)
  if (mirrored.length === 0) return
  const url = new URL(window.location.href)
  mirrored.forEach((key) => {
    const text = params[key.bagKey] ?? ''
    if (text === '') url.searchParams.delete(key.urlKey ?? '')
    else url.searchParams.set(key.urlKey ?? '', text)
  })
  window.history.replaceState(window.history.state, '', url)
}

/** Publish `value` on `wire`'s channel. */
export function publishOnChannel(wire: PublisherWire, value: unknown): void {
  if (typeof document === 'undefined') return
  const params = wireValues(wire, value)
  holdContribution(wire.bindTo, params)
  mirrorInAddress(wire, params)
  document.dispatchEvent(
    new CustomEvent(SHARED_FILTER_EVENT, { detail: { sourceId: wire.bindTo, params } })
  )
}

/**
 * The value a mirrored publisher left in the page address, or `undefined`
 * when it left none: one string, or `[from, to]` for a period.
 */
export function valueInAddress(wire: PublisherWire | undefined): unknown {
  if (wire === undefined || typeof window === 'undefined') return undefined
  const search = new URLSearchParams(window.location.search)
  const texts = wire.keys.map((key) => (key.urlKey === undefined ? null : search.get(key.urlKey)))
  if (texts.every((text) => text === null)) return undefined
  return wire.keys.length === 2 ? texts.map((text) => text ?? '') : (texts[0] ?? undefined)
}
