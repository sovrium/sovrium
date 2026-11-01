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
import {
  ViewError,
  ViewLoading,
  ViewMissing,
  type NamedHostState,
  type ViewStrings,
} from '../parts/view-states'
import { RateLimitedNotice } from '../runtime/read-failure'
import type { ReactElement } from 'react'

/**
 * The KPI's own placeholders, drawn in the card header's geometry: the read in
 * flight, and a read refused for a spent budget. Each writes its
 * `data-kpi-state` onto the island host, the one element that names the KPI.
 * Its failure and missing binding are the shared view states.
 */

/** The shared states the KPI draws, each writing its `data-kpi-state` onto the host that names it. */
const KPI_WORDS = {
  'kpi.loadFailed': 'Failed to load KPI records: {error}',
  'kpi.missingTable': 'KPI is missing a dataSource.table binding.',
} as const
const KPI_ERROR = {
  of: 'kpi',
  words: KPI_WORDS,
  host: { name: 'kpi', attributes: { 'data-kpi-state': 'error' } },
} as const
const KPI_MISSING = {
  sentence: 'kpi.missingTable',
  hint: true,
  words: KPI_WORDS,
  host: { name: 'kpi', attributes: { 'data-kpi-state': 'missing-table' } },
} as const

const LOADING_HOST: NamedHostState = { name: 'kpi', attributes: { 'data-kpi-state': 'loading' } }

export function KpiLoading({ label }: { readonly label: string | undefined }): ReactElement {
  return (
    <ViewLoading
      className={KPI_STACK_CLASSES}
      host={LOADING_HOST}
      label={label ?? 'Loading KPI...'}
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
    </ViewLoading>
  )
}

/**
 * The KPI's label above its failure: a genuine fetch failure degrades the
 * value region without dropping the card's identity.
 */
function KpiFailureLabel({
  label,
}: {
  readonly label: string | undefined
}): ReactElement | undefined {
  return label ? (
    <div
      data-role="kpi-label"
      className={`${computeKpiLabelClasses()} mb-1`}
    >
      {label}
    </div>
  ) : undefined
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

/** The KPI's failed read, under its label. */
export function KpiFailure({
  error,
  label,
  strings,
}: {
  readonly error: unknown
  readonly label: string | undefined
  readonly strings: ViewStrings
}): ReactElement {
  return (
    <ViewError
      {...{ ...KPI_ERROR, error, strings }}
      lead={<KpiFailureLabel label={label} />}
    />
  )
}

/** A KPI bound to no table and no system read. */
export function KpiMissing({ strings }: { readonly strings: ViewStrings }): ReactElement {
  return <ViewMissing {...{ ...KPI_MISSING, strings }} />
}
