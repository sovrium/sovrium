/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeKpiLabelClasses,
  KPI_STACK_CLASSES,
} from '@/presentation/design/kpi-default-classes'
import { useNamedHostAttributes } from '../hooks/use-named-host-attributes'
import { RateLimitedNotice } from '../runtime/read-failure'
import type { ReactElement } from 'react'

/**
 * Non-card KPI render states. Each writes its `data-kpi-state` onto the island
 * host, the one element that names the KPI.
 */

export function KpiLoading(): ReactElement {
  return (
    <div
      className={KPI_STACK_CLASSES}
      ref={useNamedHostAttributes<HTMLDivElement>('kpi', { 'data-kpi-state': 'loading' })}
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
      ref={useNamedHostAttributes<HTMLDivElement>('kpi', { 'data-kpi-state': 'error' })}
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

/**
 * A KPI whose records read was refused with 429: its label, and the shared
 * rate-limited notice whose Retry asks again.
 */
export function KpiRateLimited({
  label,
  onRetry,
  strings,
}: {
  readonly label?: string
  readonly onRetry: () => void
  /** The notice's words in the page language, where they differ from English. */
  readonly strings?: Readonly<Record<string, string>> | undefined
}): ReactElement {
  return (
    <div
      className={KPI_STACK_CLASSES}
      ref={useNamedHostAttributes<HTMLDivElement>('kpi', { 'data-kpi-state': 'rate-limited' })}
    >
      {label && (
        <div
          data-role="kpi-label"
          className={computeKpiLabelClasses()}
        >
          {label}
        </div>
      )}
      <RateLimitedNotice
        onRetry={onRetry}
        strings={strings}
      />
    </div>
  )
}

export function KpiMissingTable(): ReactElement {
  return (
    <div
      className="border-warning-border bg-warning-bg text-warning-fg text-md rounded border p-3"
      ref={useNamedHostAttributes<HTMLDivElement>('kpi', { 'data-kpi-state': 'missing-table' })}
      role="alert"
    >
      <p>KPI is missing a dataSource.table binding.</p>
      <p className="mt-1 opacity-80">Add it to this component in your app config, then redeploy.</p>
    </div>
  )
}
