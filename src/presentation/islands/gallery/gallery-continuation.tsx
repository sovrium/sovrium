/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeGalleryPagerClasses } from '@/presentation/design/gallery-default-classes'
import { InfiniteLoadMore } from '../parts/infinite-load-more'
import { LoadMoreButton } from '../parts/load-more-button'
import type { ReactElement } from 'react'

/** The gallery's pager chrome, which its load-more footer wears. Pure: resolved once. */
const GALLERY_PAGER_CLASSES = computeGalleryPagerClasses()

/**
 * How a gallery that grows from the top reaches its next page: a Load more
 * button, or under `infinite` the end-of-list sentinel with the same button kept
 * for the keyboard and a polite count of the cards loaded. Its words are the
 * page language's (`gallery.loadMore`, `gallery.loaded`), English where the
 * host sent none.
 */
export function GalleryContinuation({
  infinite,
  hasMore,
  loaded,
  total,
  onLoadMore,
  words,
}: {
  readonly infinite: boolean
  readonly hasMore: boolean
  readonly loaded: number
  readonly total: number
  readonly onLoadMore: () => void
  /** The gallery's words in the page language, where they differ from English. */
  readonly words?: Readonly<Record<string, string>> | undefined
}): ReactElement | undefined {
  const label = words?.['gallery.loadMore'] ?? 'Load More'
  if (!infinite)
    return hasMore ? (
      <LoadMoreButton
        onClick={onLoadMore}
        footerClassName={GALLERY_PAGER_CLASSES}
        label={label}
      />
    ) : undefined
  const status = (words?.['gallery.loaded'] ?? '{loaded} of {total} loaded')
    .replace('{loaded}', String(loaded))
    .replace('{total}', String(total))
  return (
    <InfiniteLoadMore
      hasMore={hasMore}
      isLoading={false}
      onLoadMore={onLoadMore}
      status={status}
      label={label}
      footerClassName={GALLERY_PAGER_CLASSES}
    />
  )
}
