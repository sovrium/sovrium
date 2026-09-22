/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'

/**
 * The PUBLISHER half of the shared-filter binding.
 *
 * `bindTo` + `sharedFilter` describes a component that CONSUMES a published
 * param bag, and it shipped alone: the only things that published one were a
 * `search-input` (a scalar, under its own component id) and a bespoke island
 * with no component type at all. So a config author could declare a subscriber
 * and had no way to declare what it listened to — which is why the automation
 * runs console was still synthesised from TypeScript.
 *
 * ─── THE CHANNEL IS NOT THE CONTROL'S ID ───────────────────────────────────
 *
 * `publishes.bindTo` names a CHANNEL that several controls may share, each
 * contributing its own `param`. A runs directory drives ONE grid from TWO
 * selectors, and a subscriber's `bindTo` names a single channel — so keying the
 * channel off each publisher's own id could not express it. The subscriber
 * ({@link useSharedFilter}) MERGES contributions arriving on one channel, which
 * is what puts both params in the same request.
 *
 * ─── THE KEY IS DECLARED, NEVER GUESSED ────────────────────────────────────
 *
 * `param` is required for the reason `labelKey` is: there is no defensible
 * default. Guessing the control's `props.id` would publish `?tier-filter=` to
 * an endpoint that reads `?tier=` — a filter that validates and quietly narrows
 * nothing.
 */

/** A control's own publisher declaration, as it arrives in the island props. */
export interface SharedFilterPublisherConfig {
  /** The channel this control publishes on — the string a subscriber names. */
  readonly bindTo: string
  /** The request-param key this control's value is published under. */
  readonly param: string
}

/**
 * Reuses the EXISTING `island:system-query` channel rather than minting a
 * second bus: the subscriber hook already listens to it, and a parallel event
 * would leave two publishers that a subscriber has to know apart.
 */
const SHARED_FILTER_EVENT = 'island:system-query'

/**
 * Build the change handler that publishes a control's current value.
 *
 * Returns a no-op when the control declares no `publishes`, so a plain select
 * costs one closure and dispatches nothing.
 *
 * A MULTIPLE selection publishes as its values joined by commas — the shape a
 * repeated query param already collapses to. An empty or cleared selection
 * publishes the empty string rather than dropping the key: the merged bag is
 * the subscriber's query key, so retaining a cleared key keeps the state
 * structurally distinct from the never-touched initial one and forces the
 * re-read. The fetch layer drops empty values from the actual URL.
 */
export function useSharedFilterPublisher(
  publishes: SharedFilterPublisherConfig | undefined
): (value: unknown) => void {
  const bindTo = publishes?.bindTo
  const param = publishes?.param

  return useCallback(
    (value: unknown): void => {
      if (bindTo === undefined || param === undefined) return
      if (typeof document === 'undefined') return
      const published = Array.isArray(value)
        ? value.map((one) => String(one ?? '')).join(',')
        : value === null || value === undefined
          ? ''
          : String(value)
      document.dispatchEvent(
        new CustomEvent(SHARED_FILTER_EVENT, {
          detail: { sourceId: bindTo, params: { [param]: published } },
        })
      )
    },
    [bindTo, param]
  )
}
