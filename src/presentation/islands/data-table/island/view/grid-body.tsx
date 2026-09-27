/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTablePagerClasses,
  computeTableToolbarButtonClasses,
} from '@/presentation/design/table-default-classes'
import { LoadMoreButton } from '../../../parts/load-more-button'
import { AlternateView } from '../alternate-view'
import { PaginationControls } from '../pagination'
import { TableContent } from '../table-content'
import type { GridBodyProps } from '../view-props'

/**
 * Does a pager belong on this edge of the grid?
 *
 * `position` is the author's placement request and defaults to `bottom`, which
 * is what every grid drew before the key was read — so an omitted `position`
 * keeps its pager exactly where it has always been. `both` is the only value
 * that answers `true` twice, and it is answered per edge rather than by
 * counting, so the two call sites below stay independent of each other.
 *
 * A cursor-paginated feed suppresses the pager on BOTH edges: a numbered pager
 * and a cursor continuation are alternative answers to "where am I in this
 * list", never both, so a declared `pagination` yields to the feed's own shape
 * rather than inventing a total for it.
 */
function showsPagerAt(props: GridBodyProps, edge: 'top' | 'bottom'): boolean {
  if (!props.paginationConfig || props.cursorPaged) return false
  // A load-more grid is one list, so it has no page to number and no page size
  // for the reader to pick — the size is the author's.
  if (props.paginationConfig.style === 'loadMore') return false
  const position = props.paginationConfig.position ?? 'bottom'
  return position === edge || position === 'both'
}

/** The pager itself, identical on either edge but for the border it carries. */
function GridPager({
  props,
  edge,
}: {
  readonly props: GridBodyProps
  readonly edge: 'top' | 'bottom'
}) {
  return (
    <PaginationControls
      table={props.table}
      total={props.totalRecords}
      pageSizeOptions={props.paginationConfig?.pageSizeOptions}
      position={edge}
    />
  )
}

/**
 * The rows — or the alternate view that replaces them — and the pagers that say
 * where in the list they sit.
 *
 * `pagination.position` is honoured as DOCUMENT ORDER, which is the only thing
 * "above the grid" can mean to a reader or to a screen reader: the top pager is
 * emitted before `TableContent`, the bottom one after it, and `both` emits the
 * two. Ordering them with CSS instead would leave the reading order saying the
 * opposite of what the page shows.
 *
 * The two pagers are separate elements in two fixed slots of this fragment
 * rather than one element moved between them, so React keeps them distinct by
 * position and neither needs a key. `PaginationControls` is stateless with
 * respect to placement — it reads the table instance — so drawing it twice
 * needs no new state either.
 */
export function GridBody(props: GridBodyProps) {
  return (
    <>
      {props.alternate && <AlternateView {...props.alternate} />}
      {props.showGrid && showsPagerAt(props, 'top') && (
        <GridPager
          props={props}
          edge="top"
        />
      )}
      {props.showGrid && <TableContent {...props.grid} />}
      {props.showGrid && <GridFooter {...props} />}
    </>
  )
}

const LOAD_MORE_FOOTER_CLASSES = `${computeTablePagerClasses({ position: 'bottom' })} justify-center`

/**
 * The bottom pager, and the continuation control beneath it — for a cursor feed
 * and for a table grid that loads page by page. It is drawn only while more
 * rows exist: at the end there is nothing to offer.
 */
function GridFooter(props: GridBodyProps) {
  return (
    <>
      {showsPagerAt(props, 'bottom') && (
        <GridPager
          props={props}
          edge="bottom"
        />
      )}
      {props.onLoadMore && props.hasMore && (
        <LoadMoreButton
          onClick={props.onLoadMore}
          isLoading={props.isLoadingMore}
          label="Load more"
          // The same footer chrome the page-number pager wears — it stands in
          // the same place and answers the same question — with its single
          // button centred.
          footerClassName={LOAD_MORE_FOOTER_CLASSES}
          buttonClassName={computeTableToolbarButtonClasses({ disabled: props.isLoadingMore })}
        />
      )}
    </>
  )
}
