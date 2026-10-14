/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { InfiniteLoadMore } from '../../parts/infinite-load-more'
import { useGridString } from '../island/grid-strings'
import type { ReactElement } from 'react'

/**
 * The end of a grid declaring `pagination.style: infinite`: the next page is
 * asked for as the last row scrolls into view, a Load more control stays
 * reachable from the keyboard, and a polite status counts the rows loaded
 * against the rows that exist.
 */
export function GridInfiniteFooter({
  loaded,
  total,
  hasMore,
  isLoading,
  onLoadMore,
  footerClassName,
  buttonClassName,
}: {
  readonly loaded: number
  readonly total: number
  readonly hasMore: boolean
  readonly isLoading: boolean
  readonly onLoadMore: () => void
  readonly footerClassName: string
  readonly buttonClassName: string
}): ReactElement {
  const status = useGridString('datatable.pagination.loaded', '{loaded} of {total} loaded', {
    loaded,
    total: Math.max(total, loaded),
  })
  const label = useGridString('datatable.pagination.loadMore', 'Load more')
  return (
    <InfiniteLoadMore
      hasMore={hasMore}
      isLoading={isLoading}
      onLoadMore={onLoadMore}
      status={status}
      label={label}
      footerClassName={footerClassName}
      buttonClassName={buttonClassName}
    />
  )
}
