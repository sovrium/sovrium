/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What each island publisher last sent on each channel, for a subscriber that
 * starts listening after it was sent.
 *
 * The event channel is the live path, and an event sent before a lazy
 * subscriber mounted is not heard. A control restoring its value from the page
 * address publishes at its own mount — usually before a grid's much larger
 * island has mounted — so the subscriber reads this at mount, as it reads a
 * DOM publisher's held value.
 *
 * Kept on `globalThis` under a registered symbol rather than in module state:
 * the publisher and the subscriber live in different island chunks, and a
 * module instance is not guaranteed to be shared between them.
 */
const HELD = Symbol.for('sovrium.shared-filter.held')

type Held = Map<string, Readonly<Record<string, string>>>

const heldMap = (): Held => {
  const existing: unknown = Reflect.get(globalThis, HELD)
  if (existing instanceof Map) return existing as Held
  const created: Held = new Map()
  Reflect.set(globalThis, HELD, created)
  return created
}

/** Record what a publisher just sent on `channel`. */
export function holdContribution(channel: string, params: Readonly<Record<string, string>>): void {
  const held = heldMap()
  held.set(channel, { ...held.get(channel), ...params })
}

/** Everything held on `channel`; empty when nothing was sent. */
export function heldContributions(channel: string): Readonly<Record<string, string>> {
  return heldMap().get(channel) ?? {}
}
