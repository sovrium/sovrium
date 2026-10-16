/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from '@/domain/models/app/pages'

/**
 * Name, on each control that publishes on a channel, the data components it
 * narrows — so the control can carry `aria-controls` and a screen-reader user
 * knows what operating it changes.
 *
 * Derived here, never authored: the page is the one place that sees both
 * sides of a channel. A subscriber is a data component whose `dataSource`
 * (or its `system` source) carries `bindTo` + `sharedFilter` and that has an
 * id to point at. The ids land on the publisher's `publishes` as `controls`,
 * a space-separated list, read by the island that draws the control.
 */

type Node = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The channel a data source listens on, when it subscribes to one. */
const listenedChannel = (source: unknown): string | undefined => {
  if (!isRecord(source)) return undefined
  if (isRecord(source['system'])) return listenedChannel(source['system'])
  const { bindTo } = source
  return typeof bindTo === 'string' && source['sharedFilter'] !== undefined ? bindTo : undefined
}

/** Every `[channel, id]` a subscriber under `value` declares. */
const subscribersUnder = (value: unknown): readonly (readonly [string, string])[] => {
  if (Array.isArray(value)) return value.flatMap(subscribersUnder)
  if (!isRecord(value)) return []
  const channel = listenedChannel(value['dataSource'])
  const { props } = value
  const id = isRecord(props) ? props['id'] : undefined
  const own = channel !== undefined && typeof id === 'string' ? [[channel, id] as const] : []
  return [...own, ...Object.values(value).flatMap(subscribersUnder)]
}

/** `value` with every publisher on a known channel naming its subscribers. */
const stamp = (value: unknown, controls: ReadonlyMap<string, string>): unknown => {
  if (Array.isArray(value)) return value.map((item) => stamp(item, controls))
  if (!isRecord(value)) return value
  const entries = Object.entries(value).map(([key, child]) => [key, stamp(child, controls)])
  const stamped = Object.fromEntries(entries) as Node
  const { publishes } = value
  if (!isRecord(publishes)) return stamped
  const ids = controls.get(String(publishes['bindTo']))
  return ids === undefined ? stamped : { ...stamped, publishes: { ...publishes, controls: ids } }
}

/** The page, its publishers stamped with the ids of the data components they narrow. */
export function stampChannelControls(page: Page): Page {
  const pairs = subscribersUnder(page.components)
  if (pairs.length === 0) return page
  const controls = new Map(
    [...new Set(pairs.map(([channel]) => channel))].map((channel) => [
      channel,
      pairs
        .filter(([candidate]) => candidate === channel)
        .map(([, id]) => id)
        .join(' '),
    ])
  )
  return { ...page, components: stamp(page.components, controls) as Page['components'] }
}
