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
      className="w-full rounded-lg border border-gray-200 bg-white p-4"
      data-component="kpi"
      data-kpi-state="loading"
      role="status"
      aria-label="Loading KPI..."
    >
      <div className="mb-2 h-4 w-32 animate-pulse rounded bg-gray-200" />
      <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
    </div>
  )
}

export function KpiError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
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
      className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
      data-component="kpi"
      data-kpi-state="missing-table"
      role="alert"
    >
      KPI is missing a dataSource.table binding.
    </div>
  )
}
