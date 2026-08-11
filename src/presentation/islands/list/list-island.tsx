/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderResultsBody, type ItemTemplate } from '../search/search-list-renderers'
import { hasDataBinding } from '../shared/data-binding'
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
  readonly emptyMessage?: string
  readonly 'data-testid'?: string
}

/** Missing-binding fallback — neither `table` nor `system` configured. */
function ListMissing(): ReactElement {
  return (
    <div className="border-warning-border bg-warning-bg text-warning-fg rounded border p-3 text-sm">
      List is missing required <code>dataSource</code> configuration.
    </div>
  )
}

/**
 * Loading skeleton — VISIBLE pulse rows so the host has a non-zero box while the
 * fetch is in flight. Rows are `<div>` (not `<li>`) so `#id li` stays zero until
 * the real itemTemplate items render.
 */
function ListLoading(): ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading list..."
      className="space-y-2 p-2"
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
      className="border-error-border bg-error-bg text-error-fg rounded border p-3 text-sm"
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
  emptyMessage,
}: ListIslandProps): ReactElement {
  const { data, isLoading, isError, error } = useListRecords(dataSource)

  if (!hasDataBinding(dataSource)) return <ListMissing />
  if (isLoading) return <ListLoading />
  if (isError) return <ListError error={error} />

  const records = data?.records ?? []
  return <>{renderResultsBody({ records, emptyMessage, itemTemplate, childTemplate: [] })}</>
}
