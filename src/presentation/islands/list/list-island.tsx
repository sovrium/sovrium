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
  readonly itemTemplate?: ItemTemplate
  readonly emptyMessage?: string
  readonly 'data-testid'?: string
}

function ListMissing(): ReactElement {
  return (
    <div className="border-warning-border bg-warning-bg text-warning-fg rounded border p-3 text-sm">
      List is missing required <code>dataSource</code> configuration.
    </div>
  )
}

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
