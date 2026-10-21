/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { withRecordTextFields } from '@/domain/models/app/tables/record-text-service'
import { computeListShellClasses } from '@/presentation/design/list-default-classes'
import {
  renderEmptyList,
  renderItemTemplate,
  type ItemTemplate,
  type ListRowInputs,
} from '../parts/list-item-rows'
import { hasDataBinding } from '../runtime/data-binding'
import { resolvePageLocale } from '../runtime/page-locale'
import { ListContinuation } from './list-continuation'
import { useListRowClick } from './list-row-click'
import { ListError, ListLoading, ListMissing, type ListStrings } from './list-status'
import { useListRecords, type ListRecordsDataSource } from './use-list-records'
import type { SharedFilterPublisherConfig } from '../hooks/use-shared-filter-publisher'
import type { ReactElement } from 'react'

interface ListIslandProps extends ListRowInputs {
  /** What a click on an item does — a grid row's `onRowClick`. */
  readonly onRowClick?: unknown
  /** The channel the list publishes the item a reader selects on. */
  readonly publishes?: SharedFilterPublisherConfig
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
   * `'button'` draws a Load more control; `'infinite'` loads the next page as
   * the reader scrolls to the last item, keeping that control for the keyboard
   * and announcing how many items are loaded.
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
  /** `listDisplay.hideWhenEmpty`: draw nothing — no skeleton, no empty message — until a row exists. */
  readonly hideWhenEmpty?: boolean
  /**
   * The loading, failure and rate-limit chrome in the page language
   * (`list.loading`, `list.loadFailed`, `rateLimit.*`), sent only where it
   * differs from English. Read directly rather than through a shared strings
   * helper: this island's mount budget has no room for another module.
   */
  readonly uiStrings?: Readonly<Record<string, string>>
}

/** A fetched record with the text its formatted fields print, in the page's language. */
const withText = (record: Record<string, unknown>, inputs: ListRowInputs) =>
  withRecordTextFields(record, inputs.recordText, resolvePageLocale())

/**
 * The list's rows, or its empty message. One handler on the list answers a
 * click or an Enter on any item (`inputs.onItemEvent`, from `onRowClick`).
 */
function renderRows(input: {
  readonly records: readonly Record<string, unknown>[]
  readonly emptyMessage: string | undefined
  readonly itemTemplate: ItemTemplate | undefined
  readonly inputs: ListRowInputs
}): ReactElement | undefined {
  const { records, emptyMessage, itemTemplate, inputs } = input
  if (records.length === 0 && emptyMessage) return renderEmptyList(emptyMessage, inputs.ariaLabel)
  if (itemTemplate === undefined) return undefined
  return (
    <ul
      data-slot="item-group"
      aria-label={inputs.ariaLabel}
      className={inputs.listClasses ?? computeListShellClasses()}
      onClick={inputs.onItemEvent}
      onKeyDown={inputs.onItemEvent}
    >
      {records.map((record, i) =>
        // A fetched record carries no text: attach how its formatted fields read.
        renderItemTemplate(
          itemTemplate,
          withText(record, inputs),
          { key: `item-${i}`, separated: i < records.length - 1 },
          inputs
        )
      )}
    </ul>
  )
}

/**
 * What the list shows INSTEAD of its rows — a missing binding, the fetch in
 * flight, or its failure — or `undefined` once there are rows to draw. A list
 * that hides when empty shows nothing (`null`) while it has no row to draw,
 * loading included, unless the read failed.
 */
function renderListStatus(input: {
  readonly dataSource: ListRecordsDataSource | undefined
  readonly isLoading: boolean
  readonly isError: boolean
  readonly error: unknown
  readonly onRetry: () => void
  readonly strings: ListStrings
  readonly hideWhenEmpty: boolean | undefined
  readonly drawnCount: number
}): ReactElement | null | undefined {
  if (!hasDataBinding(input.dataSource)) return <ListMissing strings={input.strings} />
  const empty = input.isLoading || input.drawnCount === 0
  if (input.hideWhenEmpty === true && empty && !input.isError) return null
  if (input.isLoading) return <ListLoading strings={input.strings} />
  if (!input.isError) return undefined
  return (
    <ListError
      error={input.error}
      onRetry={input.onRetry}
      strings={input.strings}
    />
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
 *
 * The "load more" control is offered only when all three hold: the config asked
 * for one, there is something behind the page on screen, and the list has not
 * already drawn everything it is allowed to. Rendering it on a fully loaded list
 * would be a button that does nothing; rendering it on a capped one would fetch
 * rows the cap then discards, which looks exactly the same to the reader. The
 * cap binds as soon as the drawn rows fill it — including when the page size
 * equals the cap and nothing has been sliced off yet, which is why it asks
 * whether the cap is reached rather than whether it clipped anything. The cap
 * applies to what is DRAWN, whatever the page boundaries.
 */
export default function ListIsland({
  dataSource,
  itemTemplate,
  loadMore,
  emptyMessage,
  maxItems,
  hideWhenEmpty,
  onRowClick,
  publishes,
  uiStrings,
  ...rowInputs
}: ListIslandProps): ReactElement | null {
  const {
    records,
    isLoading,
    isError,
    error,
    hasMore,
    isLoadingMore,
    loadMore: fetchMore,
    retry,
    total,
  } = useListRecords(dataSource)
  const drawn = maxItems === undefined ? records : records.slice(0, maxItems)
  const onItemEvent = useListRowClick(onRowClick, drawn, dataSource?.table, publishes)

  const status = renderListStatus({
    dataSource,
    isLoading,
    isError,
    error,
    onRetry: retry,
    strings: uiStrings,
    hideWhenEmpty,
    drawnCount: drawn.length,
  })
  if (status !== undefined) return status

  const atCap = maxItems !== undefined && drawn.length >= maxItems

  return (
    <>
      {renderRows({
        records: drawn,
        emptyMessage,
        itemTemplate,
        inputs: { ...rowInputs, onItemEvent },
      })}
      <ListContinuation
        mode={loadMore}
        hasMore={hasMore && !atCap}
        isLoading={isLoadingMore}
        loaded={drawn.length}
        total={total}
        onLoadMore={fetchMore}
        words={uiStrings}
      />
    </>
  )
}
