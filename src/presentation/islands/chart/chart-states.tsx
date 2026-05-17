/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

/**
 * Mirrors gallery-states pattern — every state still emits
 * `data-component="chart"` so spec assertions on the canonical
 * chart attribute resolve regardless of branch.
 */

export function ChartLoading(): ReactElement {
  return (
    <div
      className="w-full rounded-lg border border-gray-200 bg-white p-4"
      data-component="chart"
      data-chart-state="loading"
      role="status"
      aria-label="Loading chart..."
    >
      <div className="mb-3 h-4 w-32 animate-pulse rounded bg-gray-200" />
      <div className="flex h-48 items-end gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`chart-skeleton-${String(i)}`}
            className="flex-1 animate-pulse rounded-t bg-gray-200"
          />
        ))}
      </div>
    </div>
  )
}

export function ChartError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
      data-component="chart"
      data-chart-state="error"
      role="alert"
    >
      Failed to load chart records: {error instanceof Error ? error.message : String(error)}
    </div>
  )
}

export function ChartEmpty({ message }: { readonly message: string | undefined }): ReactElement {
  return (
    <div
      className="rounded border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500"
      data-component="chart"
      data-chart-state="empty"
    >
      {message ?? 'No data available'}
    </div>
  )
}

export function ChartMissingTable(): ReactElement {
  return (
    <div
      className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
      data-component="chart"
      data-chart-state="missing-table"
      role="alert"
    >
      Chart is missing a dataSource.table binding.
    </div>
  )
}

export function ChartMissingAxes(): ReactElement {
  return (
    <div
      className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
      data-component="chart"
      data-chart-state="missing-axes"
      role="alert"
    >
      Chart is missing xAxis or yAxis configuration.
    </div>
  )
}
