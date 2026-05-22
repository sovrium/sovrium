/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'


export function KpiLoading(): ReactElement {
  return (
    <div
      className="border-border bg-background-raised w-full rounded-lg border p-4"
      data-component="kpi"
      data-kpi-state="loading"
      role="status"
      aria-label="Loading KPI..."
    >
      <div className="bg-background-subtle mb-2 h-4 w-32 animate-pulse rounded" />
      <div className="bg-background-subtle h-8 w-24 animate-pulse rounded" />
    </div>
  )
}

export function KpiError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="border-error-border bg-error-bg text-error-fg rounded border p-3 text-sm"
      data-component="kpi"
      data-kpi-state="error"
      role="alert"
    >
      Failed to load KPI records: {error instanceof Error ? error.message : String(error)}
    </div>
  )
}

export function KpiMissingTable(): ReactElement {
  return (
    <div
      className="border-warning-border bg-warning-bg text-warning-fg rounded border p-3 text-sm"
      data-component="kpi"
      data-kpi-state="missing-table"
      role="alert"
    >
      KPI is missing a dataSource.table binding.
    </div>
  )
}
