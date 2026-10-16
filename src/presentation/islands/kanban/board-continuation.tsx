/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { InfiniteLoadMore } from '../parts/infinite-load-more'
import type { BoardWindow } from './use-board-window'
import type { ReactElement } from 'react'

/** The end of an `infinite` board: its sentinel, its Load more control and its count. */
export function BoardContinuation({
  continuation,
  words,
}: {
  readonly continuation: BoardWindow['continuation']
  /** The board's words in the page language, where they differ from English. */
  readonly words?: Readonly<Record<string, string>> | undefined
}): ReactElement | undefined {
  if (continuation === undefined) return undefined
  const loaded = words?.['kanban.loaded'] ?? '{loaded} of {total} loaded'
  return (
    <InfiniteLoadMore
      {...continuation}
      isLoading={false}
      status={loaded
        .replace('{loaded}', String(continuation.loaded))
        .replace('{total}', String(continuation.total))}
      label={words?.['kanban.loadMore'] ?? 'Load More'}
      footerClassName="flex justify-center p-3"
    />
  )
}
