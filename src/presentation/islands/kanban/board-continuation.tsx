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
}: {
  readonly continuation: BoardWindow['continuation']
}): ReactElement | undefined {
  if (continuation === undefined) return undefined
  return (
    <InfiniteLoadMore
      {...continuation}
      isLoading={false}
      status={`${String(continuation.loaded)} of ${String(continuation.total)} loaded`}
      label="Load More"
      footerClassName="flex justify-center p-3"
    />
  )
}
