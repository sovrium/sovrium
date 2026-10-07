/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'
import type { SharedFilterBindingConfig } from './use-shared-filter'
import type * as ChannelModule from '../runtime/shared-filter-channel'
import type { SharedRecordsParams } from '../runtime/shared-filter-param'

type Channel = typeof ChannelModule
type PublishedValue = ChannelModule.PublishedValue

/** What a bound view requests, and whether its channel has been read yet. */
export interface LazySharedRequest extends SharedRecordsParams {
  /**
   * The channel has been read, so a request built now carries the publisher's
   * opening value. Always true for a view bound to no channel.
   */
  readonly ready: boolean
}

/** Stable empty reference so an unbound view never churns its query key. */
const NO_PARAMS: Readonly<Record<string, string>> = {}

/**
 * The shared-filter binding of the list-family views (kanban, timeline,
 * calendar, gallery, list, chart, KPI): `useSharedFilter`'s contract, with the
 * channel module loaded ON DEMAND. A view bound to a publisher (`bindTo` +
 * `sharedFilter`) imports it when it mounts; a view that is not bound never
 * downloads it, so no view's mount cost depends on whether a page carries a
 * filter bar.
 *
 * Returns the request the view makes — its own filter narrowed by what the
 * channel publishes — and `ready: false` until the channel has been read, so
 * the first request is the filtered one rather than everything followed by a
 * re-fetch.
 */
export function useLazySharedFilter(
  { bindTo, sharedFilter }: SharedFilterBindingConfig,
  ownFilter: string | undefined
): LazySharedRequest {
  const bound = Boolean(bindTo) && sharedFilter !== undefined
  const [state, setState] = useState<{
    readonly channel?: Channel
    readonly published?: PublishedValue
  }>({})

  useEffect(() => {
    if (!bound || bindTo === undefined) return undefined
    const subscription = { stop: (): void => undefined, live: true }
    void import('../runtime/shared-filter-channel').then((channel) => {
      if (!subscription.live) return
      setState((previous) => ({ ...previous, channel }))
      subscription.stop = channel.subscribeSharedFilter(bindTo, (update) =>
        setState((previous) => ({ ...previous, published: update(previous.published) }))
      )
    })
    return () => {
      subscription.live = false
      subscription.stop()
    }
  }, [bound, bindTo])

  const channel = bound ? state.channel : undefined
  return channel === undefined || sharedFilter === undefined
    ? { filterParam: ownFilter, extraParams: NO_PARAMS, ready: !bound }
    : { ...channel.sharedRequest(state.published, sharedFilter.params, ownFilter), ready: true }
}
