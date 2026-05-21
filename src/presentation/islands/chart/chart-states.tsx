/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'


export function ChartLoading(): ReactElement {
  return (
    <div
      className="border-border bg-bg-raised w-full rounded-lg border p-4"
      data-component="chart"
      data-chart-state="loading"
      role="status"
      aria-label="Loading chart..."
    >
      <div className="bg-bg-subtle mb-3 h-4 w-32 animate-pulse rounded" />
      <div className="flex h-48 items-end gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`chart-skeleton-${String(i)}`}
            className="bg-bg-subtle flex-1 animate-pulse rounded-t"
          />
        ))}
      </div>
    </div>
  )
}

export function ChartError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="border-error-border bg-error-bg text-error-fg rounded border p-3 text-sm"
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
      className="border-border bg-bg-subtle text-fg-muted rounded border p-6 text-center text-sm"
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
      className="border-warning-border bg-warning-bg text-warning-fg rounded border p-3 text-sm"
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
      className="border-warning-border bg-warning-bg text-warning-fg rounded border p-3 text-sm"
      data-component="chart"
      data-chart-state="missing-axes"
      role="alert"
    >
      Chart is missing xAxis or yAxis configuration.
    </div>
  )
}
