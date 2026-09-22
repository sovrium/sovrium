/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeListShellClasses } from '@/presentation/design/list-default-classes'
import { hasDataBinding } from '../runtime/data-binding'
import { renderResultsBody, type ItemTemplate } from '../search/search-list-renderers'
import { ListLoadMore } from './list-load-more'
import { useListRecords, type ListRecordsDataSource } from './use-list-records'
import type { ReactElement } from 'react'

interface ListIslandProps {
  readonly dataSource?: ListRecordsDataSource
  /**
   * Declarative item template (title / subtitle / image / badge / metadata) —
   * the config (not a table field schema) drives each rendered `<li>`. Carried
   * from `listDisplay.itemTemplate`.
   */
  readonly itemTemplate?: ItemTemplate
  /**
   * How the reader reaches the records beyond the first page — carried from
   * `listDisplay.loadMore`.
   *
   * Only `'button'` renders a control. `'infinite'` is accepted by the schema
   * and is deliberately NOT implemented: scroll-triggered paging needs a
   * sentinel row, an intersection observer and a re-entrancy guard, and none of
   * that can be called shipped until something specifies how it behaves at the
   * end of the set. A list declaring it pages exactly as one declaring nothing
   * does — first page only, and no control promising more.
   */
  readonly loadMore?: string
  readonly emptyMessage?: string
  /**
   * The most rows this list may DRAW — carried from `listDisplay.maxItems`.
   *
   * A cap, not a page size, and the difference is what it does to the control
   * below: a list that has drawn its whole allowance offers no way to reach past
   * it, because the rows a further page brought back would be sliced off on
   * arrival and the button would appear to do nothing.
   */
  readonly maxItems?: number
}

/** Missing-binding fallback — neither `table` nor `system` configured. */
function ListMissing(): ReactElement {
  return (
    <div className="border-warning-border bg-warning-bg text-warning-fg text-md rounded border p-3">
      List is missing required <code>dataSource</code> configuration.
    </div>
  )
}

/**
 * Loading skeleton — VISIBLE pulse rows so the host has a non-zero box while the
 * fetch is in flight. Rows are `<div>` (not `<li>`) so `#id li` stays zero until
 * the real itemTemplate items render.
 *
 * The container carries the SHELL chrome the loaded `<ul>` will carry, so the
 * bordered surface is already drawn while the fetch is in flight and the box
 * does not appear from nothing when the records land.
 */
function ListLoading(): ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading list..."
      className={`${computeListShellClasses()} space-y-2 p-2`}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={`list-loading-row-${String(i)}`}
          className="bg-background-subtle h-6 w-full animate-pulse rounded"
        />
      ))}
    </div>
  )
}

function ListError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <p
      className="border-error-border bg-error-bg text-error-fg text-md rounded border p-3"
      role="alert"
    >
      Failed to load list items: {error instanceof Error ? error.message : String(error)}
    </p>
  )
}

/**
 * list island — client-side data-bound list (CAP-1 system-source rows binding).
 *
 * Renders `listDisplay.itemTemplate` items from EITHER a DB table
 * (`dataSource.table` → `/api/tables/:t/records`) OR a named system read endpoint
 * (`dataSource.system` → the shared system-source fetch). A system source is a
 * READ source: the island offers NO create/edit/delete affordances and no saved
 * views — it renders items only. The `data-component="list"` marker lives on the
 * SSR host wrapper (single match); this island root never re-emits it.
 */
export default function ListIsland({
  dataSource,
  itemTemplate,
  loadMore,
  emptyMessage,
  maxItems,
}: ListIslandProps): ReactElement {
  const {
    records,
    isLoading,
    isError,
    error,
    hasMore,
    isLoadingMore,
    loadMore: fetchMore,
  } = useListRecords(dataSource)

  if (!hasDataBinding(dataSource)) return <ListMissing />
  if (isLoading) return <ListLoading />
  if (isError) return <ListError error={error} />

  // The declared cap, applied to what is DRAWN. The fetch is left alone: a page
  // is a transport concern and the cap is a display one, and conflating them
  // would make the last visible row depend on the page boundary.
  const drawn = maxItems === undefined ? records : records.slice(0, maxItems)

  // The control is offered only when all three hold: the config asked for one,
  // there is something behind the page on screen, and the list has not already
  // drawn everything it is allowed to. Rendering it on a fully loaded list would
  // be a button that does nothing; rendering it on a capped one would fetch rows
  // the cap then discards, which looks exactly the same to the reader.
  //
  // The cap binds as soon as the drawn rows fill it — including when the page
  // size equals the cap and nothing has been sliced off yet, which is why this
  // asks whether the cap is reached rather than whether it clipped anything.
  const atCap = maxItems !== undefined && drawn.length >= maxItems
  const showLoadMore = loadMore === 'button' && hasMore && !atCap

  return (
    <>
      {renderResultsBody({ records: drawn, emptyMessage, itemTemplate, childTemplate: [] })}
      {showLoadMore ? (
        <ListLoadMore
          onClick={fetchMore}
          isLoading={isLoadingMore}
        />
      ) : undefined}
    </>
  )
}
