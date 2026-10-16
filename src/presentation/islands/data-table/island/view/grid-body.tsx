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
import { usePhoneViewport } from '../../../hooks/use-phone-viewport'
import { LoadMoreButton } from '../../../parts/load-more-button'
import { GridInfiniteFooter } from '../../pagination/grid-infinite-footer'
import { PaginationControls } from '../../pagination/pagination-controls'
import { SessionControls } from '../../view-options/session-controls'
import { SelectionBar } from '../bulk-actions'
import { TableContent } from '../table-content'
import { PhoneRows } from './phone-rows'
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
  if (props.paginationConfig.style === 'loadMore' || props.paginationConfig.style === 'infinite')
    return false
  const position = props.paginationConfig.position ?? 'bottom'
  return position === edge || position === 'both'
}

/** The pager above the rows: the range summary and the steps, nothing else. */
function GridPager({ props }: { readonly props: GridBodyProps }) {
  return (
    <PaginationControls
      table={props.table}
      total={props.totalRecords}
      pageSizeOptions={props.paginationConfig?.pageSizeOptions}
      position="top"
    />
  )
}

/**
 * The bottom bar, 36px, under the rows: the range summary on the left — or, once
 * rows are checked, the selection in its place — and on the right the reader's
 * session controls, then the page size and the steps when the grid numbers its
 * pages. It is drawn whenever the grid numbers its pages OR its rows can be
 * checked, whatever its `layout`: a selectable grid always has somewhere to say
 * what is selected and what can be done with it.
 */
function BottomBar({ props, paged }: { readonly props: GridBodyProps; readonly paged: boolean }) {
  const { selection } = props
  return (
    <PaginationControls
      table={props.table}
      total={props.totalRecords}
      pageSizeOptions={props.paginationConfig?.pageSizeOptions}
      position="bottom"
      paged={paged}
      leading={
        selection !== undefined && selection.selectedCount > 0 ? (
          <SelectionBar {...selection} />
        ) : undefined
      }
      trailing={<SessionControls {...props.session} />}
    />
  )
}

/**
 * The rows, and the pagers that say where in the list they sit.
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
  // `phoneLayout: rows` swaps the grid for items on a phone, and only there.
  const phoneRows = usePhoneViewport(props.phoneLayout === 'rows')
  return (
    <>
      {showsPagerAt(props, 'top') && <GridPager props={props} />}
      {phoneRows ? (
        <PhoneRows
          table={props.grid.table}
          ariaLabel={props.grid.ariaLabel}
        />
      ) : (
        <TableContent {...props.grid} />
      )}
      <GridFooter {...props} />
    </>
  )
}

const LOAD_MORE_FOOTER_CLASSES = `${computeTablePagerClasses({ position: 'bottom' })} justify-center`

/**
 * The bottom bar, and the continuation control beneath it — for a cursor feed
 * and for a table grid that loads page by page. The continuation is drawn only
 * while more rows exist: at the end there is nothing to offer.
 */
function GridFooter(props: GridBodyProps) {
  const paged = showsPagerAt(props, 'bottom')
  return (
    <>
      {(paged || props.selection !== undefined) && (
        <BottomBar
          props={props}
          paged={paged}
        />
      )}
      {props.onLoadMore && props.paginationConfig?.style === 'infinite' && (
        <GridInfiniteFooter
          loaded={props.table.getRowModel().rows.length}
          total={props.totalRecords}
          hasMore={props.hasMore}
          isLoading={props.isLoadingMore}
          onLoadMore={props.onLoadMore}
          footerClassName={LOAD_MORE_FOOTER_CLASSES}
          buttonClassName={computeTableToolbarButtonClasses({ disabled: props.isLoadingMore })}
        />
      )}
      {props.onLoadMore && props.hasMore && props.paginationConfig?.style !== 'infinite' && (
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
