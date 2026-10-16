/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeKpiLabelClasses,
  KPI_HEADER_CLASSES,
  KPI_SKELETON_CLASSES,
  KPI_STACK_CLASSES,
} from '@/presentation/design/kpi-default-classes'
import { useNamedHostAttributes } from '../hooks/use-named-host-attributes'
import { RateLimitedNotice } from '../runtime/read-failure'
import type { ReactElement } from 'react'

/**
 * Non-card KPI render states. Each writes its `data-kpi-state` onto the island
 * host, the one element that names the KPI.
 */

export function KpiLoading({ label }: { readonly label: string | undefined }): ReactElement {
  return (
    <div
      className={KPI_STACK_CLASSES}
      ref={useNamedHostAttributes<HTMLDivElement>('kpi', { 'data-kpi-state': 'loading' })}
      role="status"
      data-loading-status=""
      aria-label={label ?? 'Loading KPI...'}
    >
      {/* Two skeletons in the card header, where the label and the figure
          will sit, sized to the lines they stand in for. */}
      <div
        data-slot="card-header"
        className={KPI_HEADER_CLASSES}
      >
        <div
          data-slot="skeleton"
          className={`${KPI_SKELETON_CLASSES} h-5 w-32`}
        />
        <div
          data-slot="skeleton"
          className={`${KPI_SKELETON_CLASSES} h-8 w-24`}
        />
      </div>
    </div>
  )
}

/** The KPI's own words in the page language (`kpi.*`, `component.*`), where they differ from English. */
type KpiStrings = Readonly<Record<string, string>> | undefined

export function KpiError({
  error,
  label,
  strings,
}: {
  readonly error: unknown
  readonly label?: string
  readonly strings: KpiStrings
}): ReactElement {
  // GAP-I1: preserve the server-known label even in the error branch, so a
  // genuine fetch failure degrades the value region without dropping the card's
  // identity. The label paints above the error message rather than being
  // replaced by raw error text.
  return (
    <div
      className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border p-3 text-sm"
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
      <div>
        <p>
          {(strings?.['kpi.loadFailed'] ?? 'Failed to load KPI records: {error}').replace(
            '{error}',
            () => (error instanceof Error ? error.message : String(error))
          )}
        </p>
        <p className="mt-1 opacity-80">
          {strings?.['component.refreshToRetry'] ?? 'Refresh the page to try again.'}
        </p>
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
      <div
        data-slot="card-header"
        className={KPI_HEADER_CLASSES}
      >
        {label && (
          <div
            data-slot="card-description"
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
    </div>
  )
}

export function KpiMissingTable({ strings }: { readonly strings: KpiStrings }): ReactElement {
  return (
    <div
      className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border p-3 text-sm"
      ref={useNamedHostAttributes<HTMLDivElement>('kpi', { 'data-kpi-state': 'missing-table' })}
      role="alert"
    >
      <p>{strings?.['kpi.missingTable'] ?? 'KPI is missing a dataSource.table binding.'}</p>
      <p className="mt-1 opacity-80">
        {strings?.['component.configHint'] ??
          'Add it to this component in your app config, then redeploy.'}
      </p>
    </div>
  )
}
