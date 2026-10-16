/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeChartShellClasses } from '@/presentation/design/chart-default-classes'
import type { ReactElement } from 'react'

// The loading skeleton stands in for the chart card, so it paints the same
// frame — otherwise the border, radius and surface visibly change the moment
// the data arrives. Resolved once at module load; the recipe is pure.
//
// The error / empty / missing-table / missing-axes branches deliberately keep
// their own surfaces: those are semantic status panels (error, warning, muted
// placeholder), not the chart card, and the R-D target table has no row for
// them.
const SHELL_CLASSES = computeChartShellClasses()

/** The chart's own words in the page language (`chart.*`, `component.*`), where they differ from English. */
export type ChartStrings = Readonly<Record<string, string>> | undefined

/**
 * Chart render states. None carries `data-component="chart"`: the island host
 * names the chart once, whatever state is drawn inside it.
 */

export function ChartLoading({ strings }: { readonly strings: ChartStrings }): ReactElement {
  return (
    <div
      className={SHELL_CLASSES}
      data-chart-state="loading"
      role="status"
      data-loading-status=""
      aria-label={strings?.['chart.loading'] ?? 'Loading chart...'}
    >
      <div className="bg-muted mb-3 h-4 w-32 animate-pulse rounded" />
      <div className="flex h-48 items-end gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`chart-skeleton-${String(i)}`}
            className="bg-muted flex-1 animate-pulse rounded-t"
          />
        ))}
      </div>
    </div>
  )
}

export function ChartError({
  error,
  strings,
}: {
  readonly error: unknown
  readonly strings: ChartStrings
}): ReactElement {
  return (
    <div
      className="border-error-border bg-error-bg text-error-fg text-md rounded border p-3"
      data-chart-state="error"
      role="alert"
    >
      <p>
        {(strings?.['chart.loadFailed'] ?? 'Failed to load chart records: {error}').replace(
          '{error}',
          () => (error instanceof Error ? error.message : String(error))
        )}
      </p>
      <p className="mt-1 opacity-80">
        {strings?.['component.refreshToRetry'] ?? 'Refresh the page to try again.'}
      </p>
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
/** The empty chart's line and its guidance, the page's when the host sent them. */
const chartEmptyWords = (strings: ChartStrings) => ({
  empty: strings?.['chart.empty'] ?? 'No data to chart yet.',
  hint:
    strings?.['chart.emptyHint'] ?? "Records matching this chart's data source will appear here.",
})

export function ChartEmpty({
  message,
  emptyState,
  strings,
}: {
  readonly message: string | undefined
  readonly emptyState?: ChartEmptyStateConfig
  readonly strings: ChartStrings
}): ReactElement {
  const { empty, hint } = chartEmptyWords(strings)
  if (emptyState) {
    return (
      <section
        className="border-border bg-muted text-muted-foreground text-md rounded border p-6 text-center"
        data-chart-state="empty"
        role="region"
        aria-label={emptyState.name}
      >
        <p>{emptyState.title ?? message ?? empty}</p>
        {emptyState.title === undefined && message === undefined && (
          <p className="mt-1 opacity-80">{hint}</p>
        )}
      </section>
    )
  }
  return (
    <div
      className="border-border bg-muted text-muted-foreground text-md rounded border p-6 text-center"
      data-chart-state="empty"
    >
      <p>{message ?? empty}</p>
      {message === undefined && <p className="mt-1 opacity-80">{hint}</p>}
    </div>
  )
}

export function ChartMissingTable({ strings }: { readonly strings: ChartStrings }): ReactElement {
  return (
    <div
      className="border-warning-border bg-warning-bg text-warning-fg text-md rounded border p-3"
      data-chart-state="missing-table"
      role="alert"
    >
      <p>{strings?.['chart.missingTable'] ?? 'Chart is missing a dataSource.table binding.'}</p>
      <p className="mt-1 opacity-80">
        {strings?.['component.configHint'] ??
          'Add it to this component in your app config, then redeploy.'}
      </p>
    </div>
  )
}

export function ChartMissingAxes({ strings }: { readonly strings: ChartStrings }): ReactElement {
  return (
    <div
      className="border-warning-border bg-warning-bg text-warning-fg text-md rounded border p-3"
      data-chart-state="missing-axes"
      role="alert"
    >
      <p>{strings?.['chart.missingAxes'] ?? 'Chart is missing xAxis or yAxis configuration.'}</p>
      <p className="mt-1 opacity-80">
        {strings?.['component.configHint'] ??
          'Add it to this component in your app config, then redeploy.'}
      </p>
    </div>
  )
}
