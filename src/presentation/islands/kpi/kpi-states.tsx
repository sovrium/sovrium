/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeKpiCardClasses,
  computeKpiLabelClasses,
} from '@/presentation/design/kpi-default-classes'
import type { ReactElement } from 'react'

/**
 * Non-card KPI render states. Every state emits `data-component="kpi"` so
 * spec assertions on the canonical KPI attribute resolve in every branch.
 */

export function KpiLoading(): ReactElement {
  return (
    <div
      className={`${computeKpiCardClasses()} w-full`}
      data-component="kpi"
      data-kpi-state="loading"
      role="status"
      aria-label="Loading KPI..."
    >
      {/* Placeholder bars are sized to the parts they stand in for — a 16px
          caption line and the value's 36px leading — and spaced by the card's
          own `gap-1` rather than a margin, so the skeleton occupies the same
          box the loaded card will. */}
      <div className="bg-background-subtle h-4 w-32 animate-pulse rounded" />
      <div className="bg-background-subtle h-9 w-24 animate-pulse rounded" />
    </div>
  )
}

export function KpiError({
  error,
  label,
}: {
  readonly error: unknown
  readonly label?: string
}): ReactElement {
  // GAP-I1: preserve the server-known label even in the error branch, so a
  // genuine fetch failure degrades the value region without dropping the card's
  // identity. The label paints above the error message rather than being
  // replaced by raw error text.
  return (
    <div
      className="border-error-border bg-error-bg text-md rounded border p-3"
      data-component="kpi"
      data-kpi-state="error"
      role="alert"
    >
      {label && (
        <div
          data-role="kpi-label"
          className={`${computeKpiLabelClasses()} mb-1`}
        >
          {label}
        </div>
      )}
      <div className="text-error-fg">
        <p>Failed to load KPI records: {error instanceof Error ? error.message : String(error)}</p>
        <p className="mt-1 opacity-80">Refresh the page to try again.</p>
      </div>
    </div>
  )
}

export function KpiMissingTable(): ReactElement {
  return (
    <div
      className="border-warning-border bg-warning-bg text-warning-fg text-md rounded border p-3"
      data-component="kpi"
      data-kpi-state="missing-table"
      role="alert"
    >
      <p>KPI is missing a dataSource.table binding.</p>
      <p className="mt-1 opacity-80">Add it to this component in your app config, then redeploy.</p>
    </div>
  )
}
