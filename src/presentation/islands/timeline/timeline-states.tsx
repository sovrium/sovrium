/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'


export function TimelineLoading(): ReactElement {
  return (
    <div
      className="w-full rounded-lg border border-gray-200 bg-white p-4"
      data-component="data-timeline"
      data-timeline-state="loading"
      role="status"
      aria-label="Loading timeline..."
    >
      <div className="mb-3 h-4 w-40 animate-pulse rounded bg-gray-200" />
      <div className="space-y-2">
        <div className="h-6 w-3/4 animate-pulse rounded bg-gray-200" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-gray-200" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  )
}

export function TimelineError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
      data-component="data-timeline"
      data-timeline-state="error"
      role="alert"
    >
      Failed to load timeline records: {error instanceof Error ? error.message : String(error)}
    </div>
  )
}

export function TimelineMissingTable(): ReactElement {
  return (
    <div
      className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
      data-component="data-timeline"
      data-timeline-state="missing-table"
      role="alert"
    >
      data-timeline is missing a dataSource.table binding.
    </div>
  )
}

export function TimelineMissingStartField(): ReactElement {
  return (
    <div
      className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
      data-component="data-timeline"
      data-timeline-state="missing-start-field"
      role="alert"
    >
      data-timeline is missing a required <code>startField</code> binding.
    </div>
  )
}

export function TimelineEmpty({ message }: { readonly message?: string }): ReactElement {
  return (
    <div
      className="rounded border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500"
      data-component="data-timeline"
      data-timeline-state="empty"
      role="status"
    >
      {message ?? 'No records to display on the timeline.'}
    </div>
  )
}
