/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { conditionKey } from './shared-filter-condition-service'

/**
 * How a `publishes` declaration is normalised to the keys it writes on its
 * shared-filter channel: the publisher's half of the wire. The condition keys
 * and how a subscriber reads them back live in `shared-filter-condition-service`.
 */

/** One key a publisher writes, and the address-bar name it is mirrored under, if any. */
export interface PublishedKey {
  readonly bagKey: string
  readonly urlKey?: string
}

/** A `publishes` declaration, normalised to the keys it writes on its channel. */
export interface PublisherWire {
  readonly bindTo: string
  /** One key, or two for a period (its first and last day). */
  readonly keys: readonly PublishedKey[]
  /** What a switch or a toggle publishes while on; `undefined` for any other form. */
  readonly onValue?: string
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

/** The key, mirrored as `<channel>.<name>` when the declaration opted in. */
const keyed = (bagKey: string, mirrored: string | undefined): PublishedKey =>
  mirrored === undefined ? { bagKey } : { bagKey, urlKey: mirrored }

/** A period: two conditions on one field, or two params. */
const rangeKeys = (
  publishes: Readonly<Record<string, unknown>>,
  mirror: (name: string) => string | undefined
): readonly PublishedKey[] | undefined => {
  const field = text(publishes['field'])
  if (field !== undefined && publishes['operator'] === undefined) {
    return [
      keyed(conditionKey('gte', field), mirror(`${field}.from`)),
      keyed(conditionKey('lte', field), mirror(`${field}.to`)),
    ]
  }
  const { params } = publishes
  if (!isRecord(params)) return undefined
  const from = text(params['from'])
  const to = text(params['to'])
  return from === undefined || to === undefined
    ? undefined
    : [keyed(from, mirror(from)), keyed(to, mirror(to))]
}

/**
 * Normalise a `publishes` declaration — any of its forms — to the keys it
 * writes, or `undefined` when there is none (or it names no channel).
 */
export const publisherWire = (publishes: unknown): PublisherWire | undefined => {
  if (!isRecord(publishes)) return undefined
  const bindTo = text(publishes['bindTo'])
  if (bindTo === undefined) return undefined
  const mirror = (name: string): string | undefined =>
    publishes['url'] === true ? `${bindTo}.${name}` : undefined
  const param = text(publishes['param'])
  if (param !== undefined) return { bindTo, keys: [keyed(param, mirror(param))] }
  const field = text(publishes['field'])
  const operator = text(publishes['operator'])
  if (field !== undefined && operator !== undefined) {
    const { value } = publishes
    return {
      bindTo,
      keys: [keyed(conditionKey(operator, field), mirror(field))],
      onValue: value === undefined ? 'true' : String(value),
    }
  }
  const range = rangeKeys(publishes, mirror)
  return range === undefined ? undefined : { bindTo, keys: range }
}
