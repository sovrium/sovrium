/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  publisherWire,
  type PublisherWire,
} from '@/domain/models/app/pages/shared-filter-wire-service'
import { publishOnChannel, valueInAddress } from '../runtime/shared-filter-publish'

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

/**
 * A control's own publisher declaration, as it arrives in the island props —
 * any of its forms: a request param (`param`), a condition (`field` +
 * `operator`, with a switch's `value`), or a period (`field` alone, or
 * `params: { from, to }`). `url` mirrors it in the page address.
 */
export interface SharedFilterPublisherConfig {
  /** The channel this control publishes on — the string a subscriber names. */
  readonly bindTo: string
  readonly param?: string
  readonly field?: string
  readonly operator?: string
  readonly value?: string | number | boolean
  readonly params?: { readonly from: string; readonly to: string }
  readonly url?: boolean
}

/** The declaration, normalised once per distinct declaration. */
const useWire = (publishes: SharedFilterPublisherConfig | undefined): PublisherWire | undefined => {
  const signature = publishes === undefined ? '' : JSON.stringify(publishes)
  // `signature` stands in for the object's identity, which changes per render.
  return useMemo(() => publisherWire(publishes), [signature])
}

/**
 * The value a control with `publishes.url` left in the page address, read
 * once at mount: the control opens on it, and it is published at mount so
 * the subscribers open narrowed too. `undefined` when there is none.
 */
export function usePublishedValueInAddress(
  publishes: SharedFilterPublisherConfig | undefined
): unknown {
  const wire = useWire(publishes)
  const [restored] = useState(() => valueInAddress(wire))
  return restored
}

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
  const wire = useWire(publishes)

  useEffect(() => {
    const restored = valueInAddress(wire)
    if (wire !== undefined && restored !== undefined) publishOnChannel(wire, restored)
  }, [wire])

  return useCallback(
    (value: unknown): void => {
      if (wire !== undefined) publishOnChannel(wire, value)
    },
    [wire]
  )
}
