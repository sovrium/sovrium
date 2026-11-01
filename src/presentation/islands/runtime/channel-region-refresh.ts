/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A server-drawn list following a shared-filter channel, with no island.
 *
 * A `list` drawn through a `children` row template has its rows expanded by the
 * server, which owns `$record` and every per-row gate, so the client never
 * redraws a row itself. When the channel it listens on changes, the page is
 * rendered again under an address carrying the channel's conditions
 * (`?<channel>.<param>=`, which the server reads in `channel-row-lists.ts`) and
 * the list's region is swapped in place: the reader's own address is left as
 * it is, and nothing navigates.
 *
 * The subscription is the one every subscriber island uses
 * (`subscribeSharedFilter`), so a list hears what a grid hears: the bar's
 * events, and the value a publisher held in the DOM before this listened. That
 * first value is the one the server already drew, so it is only remembered.
 *
 * A split chunk, imported by the core runtime only on a page that holds such a
 * list (most pages hold none, and every page loads the core); it follows the
 * page's regions as it is evaluated, once per document.
 */

import { isConditionKey } from '@/domain/models/app/pages/shared-filter-condition-service'
import { fetchRenderedPage, swapUnheldRegion } from './refetch-server-rendered-region'
import { subscribeSharedFilter, type PublishedValue } from './shared-filter-channel'

/** The attribute the server stamps on each region, naming its channel. */
const REGION_ATTRIBUTE = 'data-channel-region'

/** The channels already followed, so two regions on one channel subscribe once. */
const followed = new Set<string>()

/**
 * The page's address with `channel`'s params replaced by what `published` holds
 * that narrows rows: the bar's `filter` and each contributed condition. A
 * search term or another request param narrows nothing the server draws here,
 * so a keystroke in a search box costs no page render.
 */
function addressFor(channel: string, published: PublishedValue | undefined): string {
  const url = new URL(window.location.href)
  const prefix = `${channel}.`
  Array.from(url.searchParams.keys())
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => url.searchParams.delete(key))
  Object.entries(published?.value ?? {})
    .filter(([param]) => param === 'filter' || isConditionKey(param))
    .forEach(([param, value]) => url.searchParams.set(`${prefix}${param}`, value))
  return url.href
}

/**
 * Redraw every region `selector` matches from the page rendered at `href`. The
 * live and fresh regions pair in document order, which the conditions cannot
 * change: they narrow the rows INSIDE each region, never the regions. A region
 * holding a mounted island or an open confirm gate is left alone, and the swap is
 * skipped when `isCurrent` says a later read superseded this one, so a slow
 * answer never overwrites a newer one.
 */
async function refreshRegionsFrom(
  selector: string,
  href: string,
  isCurrent: () => boolean
): Promise<void> {
  const rendered = await fetchRenderedPage(href)
  if (!rendered || !isCurrent()) return
  const fresh = Array.from(rendered.querySelectorAll(selector))
  Array.from(document.querySelectorAll<HTMLElement>(selector)).forEach((live, index) => {
    const copy = fresh[index]
    if (copy) swapUnheldRegion({ live, fresh: copy })
  })
}

/** Redraw `channel`'s regions each time the address its conditions make changes. */
function follow(channel: string): void {
  const selector = `[${REGION_ATTRIBUTE}="${CSS.escape(channel)}"]`
  let published: PublishedValue | undefined
  let drawn: string | undefined
  let reads = 0
  subscribeSharedFilter(channel, (update) => {
    published = update(published)
    const address = addressFor(channel, published)
    if (drawn === undefined || address === drawn) {
      drawn = address
      return
    }
    drawn = address
    const read = ++reads
    void refreshRegionsFrom(selector, address, () => read === reads)
  })
}

/** Follow the channel of every region on the page. */
function followChannelRegions(): void {
  document.querySelectorAll<HTMLElement>(`[${REGION_ATTRIBUTE}]`).forEach((region) => {
    const channel = region.getAttribute(REGION_ATTRIBUTE)
    if (channel === null || followed.has(channel)) return
    followed.add(channel)
    follow(channel)
  })
}

followChannelRegions()
