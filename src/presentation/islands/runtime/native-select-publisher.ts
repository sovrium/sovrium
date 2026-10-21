/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The PUBLISHER half of a shared filter for an island-less `select.native`.
 *
 * A `select` carrying `native: true` mounts no island, so the
 * dispatch `useSharedFilterPublisher` performs for the themed control has to
 * happen from the GLOBAL vanilla runtime instead — one `change` listener per
 * declaring element, on the SAME `island:system-query` channel a subscriber
 * grid already listens to. Minting a second bus would leave every subscriber
 * having to tell two apart.
 *
 * Lives beside `confirm-gate-runtime` / `session-resolver` rather than inside
 * `client.ts` for the reason those do: it is runtime shared with the island
 * layer — `use-shared-filter.ts` reads the very same two attributes at mount —
 * and keeping the pair in one place is what stops the publisher and its
 * late-join capture drifting on what a published value looks like.
 */

import { reloadOnceForStaleChunk } from './stale-chunk-reload'
import type * as NativeSelectAddress from './native-select-address'

/** The channel name, identical to the island publisher's. */
const SHARED_FILTER_EVENT = 'island:system-query'

/**
 * A MULTIPLE selection publishes its values comma-joined, exactly as the island
 * publisher does, so the two controls are interchangeable to a subscriber.
 */
export function publishedSelectValue(select: HTMLSelectElement): string {
  if (!select.multiple) return select.value
  return Array.from(select.selectedOptions)
    .map((option) => option.value)
    .join(',')
}

/** The declaring `<select>` a `change` must have come from in order to publish. */
const PUBLISHER_SELECTOR = 'select[data-publishes-bind-to][data-publishes-param]'

/** A declaring `<select>` whose choice is mirrored in the page address. */
const MIRRORED_SELECTOR = 'select[data-publishes-bind-to][data-publishes-param][data-publishes-url]'

/** Send `value` on `bindTo`'s channel. */
function publish(bindTo: string, param: string, value: string): void {
  document.dispatchEvent(
    new CustomEvent(SHARED_FILTER_EVENT, {
      detail: { sourceId: bindTo, params: { [param]: value } },
    })
  )
}

/**
 * Run `use` against the address half (`native-select-address.ts`), a split
 * chunk fetched only on a page holding a mirrored select: few pages carry one,
 * and every page loads this runtime. A chunk a newer release replaced reloads
 * the page once, as the loader's own features do.
 */
function withAddress(use: (address: typeof NativeSelectAddress) => void): void {
  import('./native-select-address').then(use).catch((error: unknown) => {
    if (!reloadOnceForStaleChunk(error)) throw error
  })
}

/** Open the page's mirrored selects on the address, if it holds any. */
function restoreMirrored(): void {
  if (document.querySelector(MIRRORED_SELECTOR) !== null)
    withAddress((address) => address.restoreFromAddress(MIRRORED_SELECTOR, publish))
}

/**
 * Publish on every `change` from a declaring `<select>`, wherever it came from.
 *
 * ONE delegated listener rather than one per element, for the reason `delegate`
 * in `presentation/client.ts` sets out at length: a select arriving with a
 * refreshed server-rendered region carries its two attributes and would carry
 * no listener, so its filter would quietly stop publishing while still looking
 * like a working control. `change` bubbles, so the delegated form is exact
 * rather than approximate — and it keeps the very selector the per-element
 * sweep used, so the themed island's own publisher (a hidden `input`, never a
 * `select`) stays as untouched by this as it was before.
 *
 * A cleared selection publishes the empty string rather than dropping the key:
 * the merged bag is the subscriber's query key, so retaining a cleared key
 * keeps the state structurally distinct from the never-touched initial one and
 * forces the re-read. The fetch layer drops empty values from the actual URL.
 */
export function setupNativeSelectPublishers(): void {
  document.addEventListener('change', (event) => {
    const { target } = event
    if (!(target instanceof Element)) return
    const select = target.closest<HTMLSelectElement>(PUBLISHER_SELECTOR)
    if (!select) return
    const bindTo = select.getAttribute('data-publishes-bind-to')
    const param = select.getAttribute('data-publishes-param')
    if (bindTo === null || param === null) return
    const value = publishedSelectValue(select)
    publish(bindTo, param, value)
    if (select.hasAttribute('data-publishes-url'))
      withAddress((address) => address.mirrorInAddress(bindTo, param, value))
  })
  restoreMirrored()
  document.addEventListener('sovrium:navigated', restoreMirrored)
}
