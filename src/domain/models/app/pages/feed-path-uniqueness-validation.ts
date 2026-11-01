/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { PageRss } from './rss'

/**
 * One feed address, one feed: two pages may not both publish at one address
 * when either of them named it.
 *
 * A page that declares `rss` publishes its feed at `rss.path`, or at
 * `/feed.xml` when it names none. Two pages that both default to `/feed.xml`
 * still pass: an app could declare that before a feed could name its address,
 * and the first public one keeps building the feed. A page NAMING an address
 * another feed already uses, `/feed.xml` included, is a mistake (a copied
 * page, most often) and is refused, naming both pages.
 */

/** The address a feed is served at when its page names none. */
export const DEFAULT_FEED_PATH = '/feed.xml'

/** The page shape this check reads. */
export interface PageForFeedPathUniqueness {
  readonly name: string
  readonly rss?: PageRss | undefined
}

/** A refusal: the index of the second page publishing at an address, and why. */
export interface DuplicateFeedPath {
  readonly index: number
  readonly message: string
}

/** Whether the page publishes a feed at all. */
export const publishesFeed = (page: { readonly rss?: PageRss | undefined }): boolean =>
  page.rss !== undefined && page.rss !== false

/** The `rss.path` the page names, or `undefined` when it names none. */
const declaredFeedPath = (page: { readonly rss?: PageRss | undefined }): string | undefined =>
  typeof page.rss === 'object' ? page.rss.path : undefined

/** The address the page's feed is served at: its `rss.path`, else `/feed.xml`. */
export const resolveFeedPath = (page: { readonly rss?: PageRss | undefined }): string =>
  declaredFeedPath(page) ?? DEFAULT_FEED_PATH

/**
 * The first page publishing a feed at an address an earlier page's feed
 * already uses, when at least one of the two named that address; `undefined`
 * when every named address is a feed's own. The message names both pages in
 * declaration order, then the address.
 */
export const findDuplicateFeedPath = (
  pages: ReadonlyArray<PageForFeedPathUniqueness>
): DuplicateFeedPath | undefined =>
  pages
    .map((page, index) => {
      if (!publishesFeed(page)) return undefined
      const address = resolveFeedPath(page)
      const named = declaredFeedPath(page) !== undefined
      const first = pages.findIndex(
        (other, otherIndex) =>
          otherIndex < index &&
          publishesFeed(other) &&
          resolveFeedPath(other) === address &&
          (named || declaredFeedPath(other) !== undefined)
      )
      return first === -1
        ? undefined
        : {
            index,
            message: `Pages "${pages[first]?.name}" and "${page.name}" both publish a feed at ${address}`,
          }
    })
    .find((duplicate) => duplicate !== undefined)
