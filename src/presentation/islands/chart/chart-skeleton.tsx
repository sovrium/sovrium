/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeChartShellClasses } from '@/presentation/design/chart-default-classes'
import {
  ViewEmpty,
  ViewError,
  ViewLoading,
  ViewMissing,
  type ViewStrings,
} from '../parts/view-states'
import type { ReactElement } from 'react'

// The loading skeleton stands in for the chart card, so it paints the same
// frame — otherwise the border, radius and surface visibly change the moment
// the data arrives. Resolved once at module load; the recipe is pure.
const SHELL_CLASSES = computeChartShellClasses()

const LOADING_ATTRIBUTES = { 'data-chart-state': 'loading' } as const

/**
 * What the chart draws INSTEAD of its canvas: its loading skeleton, and its
 * failure, empty and missing-binding states through the shared view states,
 * in the chart's own English.
 */

/**
 * The chart's loading state. It carries no `data-component="chart"`: the
 * island host names the chart once, whatever state is drawn inside it.
 */
export function ChartLoading({ strings }: { readonly strings: ViewStrings }): ReactElement {
  return (
    <ViewLoading
      className={SHELL_CLASSES}
      attributes={LOADING_ATTRIBUTES}
      label={strings?.['chart.loading'] ?? 'Loading chart...'}
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
    </ViewLoading>
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
  /** The next step, drawn under the title inside the region. */
  readonly description?: string
}

/** The `data-chart-state` each shared state carries: the island host names the chart once. */
const STATE = {
  error: { 'data-chart-state': 'error' },
  empty: { 'data-chart-state': 'empty' },
  'chart.missingTable': { 'data-chart-state': 'missing-table' },
  'chart.missingAxes': { 'data-chart-state': 'missing-axes' },
} as const

/** The chart's English for the shared view states. */
const WORDS = {
  'chart.loadFailed': 'Couldn’t load the chart.',
  'chart.missingTable': 'Chart is missing a dataSource.table binding.',
  'chart.missingAxes': 'Chart is missing xAxis or yAxis configuration.',
  'chart.empty': 'No data to chart yet.',
  'chart.emptyHint': "Records matching this chart's data source will appear here.",
} as const

/** A binding the chart's config left out. */
function ChartMissing({
  sentence,
  strings,
}: {
  readonly sentence: 'chart.missingTable' | 'chart.missingAxes'
  readonly strings: ViewStrings
}): ReactElement {
  return (
    <ViewMissing
      sentence={sentence}
      hint
      words={WORDS}
      strings={strings}
      attributes={STATE[sentence]}
    />
  )
}

/** A chart bound to no table and no system read. */
export const ChartMissingTable = ({ strings }: { readonly strings: ViewStrings }): ReactElement => (
  <ChartMissing
    sentence="chart.missingTable"
    strings={strings}
  />
)

/** A chart with no axis to plot. */
export const ChartMissingAxes = ({ strings }: { readonly strings: ViewStrings }): ReactElement => (
  <ChartMissing
    sentence="chart.missingAxes"
    strings={strings}
  />
)

/** The chart's failed read. */
export function ChartFailure({
  error,
  strings,
}: {
  readonly error: unknown
  readonly strings: ViewStrings
}): ReactElement {
  return (
    <ViewError
      of="chart"
      words={WORDS}
      error={error}
      strings={strings}
      attributes={STATE.error}
    />
  )
}

/** No row to chart: the author's `emptyMessage`, or a named `emptyState` region. */
export function ChartNothing({
  emptyMessage,
  emptyState,
  strings,
}: {
  readonly emptyMessage: string | undefined
  readonly emptyState?: ChartEmptyStateConfig
  readonly strings: ViewStrings
}): ReactElement {
  return (
    <ViewEmpty
      of="chart"
      words={WORDS}
      message={emptyMessage}
      region={emptyState}
      strings={strings}
      attributes={STATE.empty}
    />
  )
}
