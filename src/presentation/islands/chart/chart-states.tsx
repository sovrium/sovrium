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
      className="border-border bg-background-raised w-full rounded-lg border p-4"
      data-component="chart"
      data-chart-state="loading"
      role="status"
      aria-label="Loading chart..."
    >
      <div className="bg-background-subtle mb-3 h-4 w-32 animate-pulse rounded" />
      <div className="flex h-48 items-end gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`chart-skeleton-${String(i)}`}
            className="bg-background-subtle flex-1 animate-pulse rounded-t"
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
      <p>Failed to load chart records: {error instanceof Error ? error.message : String(error)}</p>
      <p className="mt-1 opacity-80">Refresh the page to try again.</p>
    </div>
  )
}

/**
 * Optional NAMED empty-state region config (chart schema `emptyState`). When
 * present, the chart's zero-rows branch renders an accessible ARIA landmark
 * `region` (role + accessible name + body title) instead of the unnamed default.
 */
export interface ChartEmptyStateConfig {
  readonly role: 'region'
  readonly name: string
  readonly title?: string
}

/**
 * Zero-rows branch. When `emptyState` is set the empty placeholder becomes a
 * NAMED `role="region"` landmark (accessible name from `emptyState.name`, body
 * text from `emptyState.title`, falling back to `message` then a default) — a
 * screen-reader user can navigate to the "no data" region. Absent `emptyState`
 * keeps the plain unnamed `<div>` (purely additive, no regression).
 */
export function ChartEmpty({
  message,
  emptyState,
}: {
  readonly message: string | undefined
  readonly emptyState?: ChartEmptyStateConfig
}): ReactElement {
  if (emptyState) {
    return (
      <section
        className="border-border bg-background-subtle text-foreground-muted rounded border p-6 text-center text-sm"
        data-component="chart"
        data-chart-state="empty"
        role="region"
        aria-label={emptyState.name}
      >
        <p>{emptyState.title ?? message ?? 'No data to chart yet.'}</p>
        {emptyState.title === undefined && message === undefined && (
          <p className="mt-1 opacity-80">
            Records matching this chart&apos;s data source will appear here.
          </p>
        )}
      </section>
    )
  }
  return (
    <div
      className="border-border bg-background-subtle text-foreground-muted rounded border p-6 text-center text-sm"
      data-component="chart"
      data-chart-state="empty"
    >
      <p>{message ?? 'No data to chart yet.'}</p>
      {message === undefined && (
        <p className="mt-1 opacity-80">
          Records matching this chart&apos;s data source will appear here.
        </p>
      )}
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
      <p>Chart is missing a dataSource.table binding.</p>
      <p className="mt-1 opacity-80">Add it to this component in your app config, then redeploy.</p>
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
      <p>Chart is missing xAxis or yAxis configuration.</p>
      <p className="mt-1 opacity-80">Add it to this component in your app config, then redeploy.</p>
    </div>
  )
}
